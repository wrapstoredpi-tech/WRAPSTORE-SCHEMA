-- ============================================================
-- WRAPSTORE OMNICHANNEL MIGRATION
-- Phase 1: Connect POS + Online Website via shared Supabase
-- Run this entire file in Supabase SQL Editor
-- Safe to run on existing database (uses IF NOT EXISTS)
-- ============================================================

-- ============================================================
-- STEP 1: Extend INVOICES table
-- ============================================================

-- Which channel generated this invoice?
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS sale_channel TEXT NOT NULL DEFAULT 'POS'
    CHECK (sale_channel IN ('POS', 'ONLINE', 'MANUAL'));

-- Reference to the online order that spawned this invoice (nullable)
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS online_order_id UUID;

CREATE INDEX IF NOT EXISTS idx_invoices_channel ON invoices(sale_channel);
CREATE INDEX IF NOT EXISTS idx_invoices_online_order ON invoices(online_order_id);

-- ============================================================
-- STEP 2: Extend PRODUCTS table
-- ============================================================

-- Control whether this product is listed on the website
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS online_visible BOOLEAN NOT NULL DEFAULT TRUE;

-- Feature on the website homepage / promotions
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS online_featured BOOLEAN NOT NULL DEFAULT FALSE;

-- URL-friendly slug for the website product page
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS seo_slug TEXT;

-- Short description for website SEO meta tags
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS meta_description TEXT;

-- Stock reserved by active online checkouts (not yet paid)
-- available_stock = current_stock - reserved_stock
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS reserved_stock INT NOT NULL DEFAULT 0
    CHECK (reserved_stock >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_seo_slug ON products(seo_slug)
  WHERE seo_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_online_visible ON products(online_visible, approval_status);
CREATE INDEX IF NOT EXISTS idx_products_online_featured ON products(online_featured);

-- ============================================================
-- STEP 3: Update INVENTORY MOVEMENTS constraint
-- Add ONLINE_SALE, ONLINE_RETURN, STOCK_RESERVED, RESERVATION_RELEASED
-- ============================================================

ALTER TABLE inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_movement_type_check;

ALTER TABLE inventory_movements
  ADD CONSTRAINT inventory_movements_movement_type_check
  CHECK (movement_type IN (
    'INITIAL_STOCK',
    'ADD_STOCK',
    'REMOVE_STOCK',
    'MANUAL_ADJUSTMENT',
    'DAMAGED',
    'CUSTOMER_RETURN',
    'SALE',
    'ONLINE_SALE',
    'ONLINE_RETURN',
    'STOCK_RESERVED',
    'RESERVATION_RELEASED'
  ));

-- ============================================================
-- STEP 4: Create ONLINE_ORDERS table
-- Captures website orders before they become invoices
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS online_order_id_seq START 1;

CREATE TABLE IF NOT EXISTS online_orders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number      TEXT UNIQUE NOT NULL DEFAULT '',   -- WS-ONL-000001
  customer_id       UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name     TEXT NOT NULL,
  customer_phone    TEXT NOT NULL,
  customer_email    TEXT,
  shipping_address  TEXT,
  billing_address   TEXT,
  subtotal          NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  gst_amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  grand_total       NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method    TEXT NOT NULL DEFAULT 'Online'
                      CHECK (payment_method IN ('Online', 'COD', 'UPI', 'Card', 'Wallet')),
  payment_status    TEXT NOT NULL DEFAULT 'PENDING'
                      CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED')),
  order_status      TEXT NOT NULL DEFAULT 'PENDING'
                      CHECK (order_status IN (
                        'PENDING',
                        'CONFIRMED',
                        'PROCESSING',
                        'READY_FOR_PICKUP',
                        'SHIPPED',
                        'DELIVERED',
                        'CANCELLED',
                        'RETURNED'
                      )),
  payment_reference TEXT,          -- Razorpay / payment gateway order/payment id
  invoice_id        UUID REFERENCES invoices(id) ON DELETE SET NULL,
  source            TEXT NOT NULL DEFAULT 'WEBSITE'
                      CHECK (source IN ('WEBSITE', 'WHATSAPP', 'PHONE', 'INSTAGRAM')),
  notes             TEXT,
  cancelled_reason  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-generate order number: WS-ONL-000001
CREATE OR REPLACE FUNCTION generate_online_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'WS-ONL-' || LPAD(nextval('online_order_id_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_online_order_number ON online_orders;
CREATE TRIGGER trigger_online_order_number
  BEFORE INSERT ON online_orders
  FOR EACH ROW EXECUTE FUNCTION generate_online_order_number();

DROP TRIGGER IF EXISTS trigger_online_orders_updated_at ON online_orders;
CREATE TRIGGER trigger_online_orders_updated_at
  BEFORE UPDATE ON online_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_online_orders_number ON online_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_online_orders_customer ON online_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_online_orders_status ON online_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_online_orders_payment_status ON online_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_online_orders_created ON online_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_online_orders_invoice ON online_orders(invoice_id);

-- ============================================================
-- STEP 5: Create ONLINE_ORDER_ITEMS table
-- ============================================================

CREATE TABLE IF NOT EXISTS online_order_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id         UUID NOT NULL REFERENCES online_orders(id) ON DELETE CASCADE,
  product_id       UUID REFERENCES products(id) ON DELETE SET NULL,
  product_id_code  TEXT,
  product_name     TEXT NOT NULL,
  product_type     TEXT,
  mobile_brand     TEXT,
  mobile_model     TEXT,
  quantity         INT NOT NULL CHECK (quantity > 0),
  unit_price       NUMERIC(10,2) NOT NULL,
  discount_pct     NUMERIC(5,2) NOT NULL DEFAULT 0,
  gst_pct          NUMERIC(5,2) NOT NULL DEFAULT 0,
  line_total       NUMERIC(10,2) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_online_order_items_order ON online_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_online_order_items_product ON online_order_items(product_id);

-- ============================================================
-- STEP 6: Atomic Stock RPC Functions
-- Row-level locking (FOR UPDATE) prevents race conditions when
-- POS and website sell the same item at the same time
-- ============================================================

-- 6a. DEDUCT STOCK — called after payment confirmed or POS sale
CREATE OR REPLACE FUNCTION deduct_stock(
  p_product_id   UUID,
  p_quantity     INT,
  p_channel      TEXT DEFAULT 'POS',
  p_reference_id TEXT DEFAULT NULL,
  p_performed_by UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_current_stock INT;
  v_reserved      INT;
  v_new_stock     INT;
  v_movement_type TEXT;
BEGIN
  -- Lock the row to prevent concurrent updates
  SELECT current_stock, reserved_stock
  INTO v_current_stock, v_reserved
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Product not found');
  END IF;

  IF v_current_stock < p_quantity THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Insufficient stock',
      'available', v_current_stock,
      'requested', p_quantity
    );
  END IF;

  v_new_stock     := v_current_stock - p_quantity;
  v_movement_type := CASE WHEN p_channel = 'ONLINE' THEN 'ONLINE_SALE' ELSE 'SALE' END;

  UPDATE products SET
    current_stock  = v_new_stock,
    reserved_stock = GREATEST(0, reserved_stock - p_quantity),
    updated_at     = NOW()
  WHERE id = p_product_id;

  INSERT INTO inventory_movements (
    product_id, movement_type, quantity,
    previous_stock, new_stock,
    reason, reference_id, performed_by
  ) VALUES (
    p_product_id,
    v_movement_type,
    p_quantity,
    v_current_stock,
    v_new_stock,
    p_channel || ' sale',
    p_reference_id,
    p_performed_by
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'previous_stock', v_current_stock,
    'new_stock', v_new_stock,
    'deducted', p_quantity
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6b. RESERVE STOCK — called when customer enters checkout on website
CREATE OR REPLACE FUNCTION reserve_stock(
  p_product_id   UUID,
  p_quantity     INT,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_current_stock INT;
  v_reserved      INT;
  v_available     INT;
BEGIN
  SELECT current_stock, reserved_stock
  INTO v_current_stock, v_reserved
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Product not found');
  END IF;

  v_available := v_current_stock - v_reserved;

  IF v_available < p_quantity THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Insufficient available stock',
      'available', v_available,
      'requested', p_quantity
    );
  END IF;

  UPDATE products SET
    reserved_stock = reserved_stock + p_quantity,
    updated_at     = NOW()
  WHERE id = p_product_id;

  INSERT INTO inventory_movements (
    product_id, movement_type, quantity,
    previous_stock, new_stock,
    reason, reference_id
  ) VALUES (
    p_product_id,
    'STOCK_RESERVED',
    p_quantity,
    v_current_stock,
    v_current_stock,
    'Online checkout reservation',
    p_reference_id
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'reserved', p_quantity,
    'available_after', v_available - p_quantity
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6c. RELEASE RESERVATION — called when checkout is abandoned or order cancelled
CREATE OR REPLACE FUNCTION release_reserved_stock(
  p_product_id   UUID,
  p_quantity     INT,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_current_stock INT;
BEGIN
  SELECT current_stock INTO v_current_stock
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Product not found');
  END IF;

  UPDATE products SET
    reserved_stock = GREATEST(0, reserved_stock - p_quantity),
    updated_at     = NOW()
  WHERE id = p_product_id;

  INSERT INTO inventory_movements (
    product_id, movement_type, quantity,
    previous_stock, new_stock,
    reason, reference_id
  ) VALUES (
    p_product_id,
    'RESERVATION_RELEASED',
    p_quantity,
    v_current_stock,
    v_current_stock,
    'Checkout abandoned / order cancelled',
    p_reference_id
  );

  RETURN jsonb_build_object('success', TRUE, 'released', p_quantity);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- STEP 7: Convenience VIEW — products with available stock
-- Use this in POS Inventory and website product listing
-- ============================================================

CREATE OR REPLACE VIEW products_with_availability AS
SELECT
  p.*,
  (p.current_stock - p.reserved_stock)  AS available_stock,
  CASE
    WHEN (p.current_stock - p.reserved_stock) <= 0        THEN 'OUT_OF_STOCK'
    WHEN (p.current_stock - p.reserved_stock) <= p.min_stock_level THEN 'LOW_STOCK'
    ELSE 'IN_STOCK'
  END AS stock_status
FROM products p;

-- ============================================================
-- STEP 8: Row Level Security for new tables
-- ============================================================

ALTER TABLE online_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE online_order_items ENABLE ROW LEVEL SECURITY;

-- Anonymous website users can INSERT new orders
DROP POLICY IF EXISTS "Anon can create online orders" ON online_orders;
CREATE POLICY "Anon can create online orders" ON online_orders
  FOR INSERT TO anon WITH CHECK (TRUE);

-- Anonymous users can read orders (website order-tracking page)
DROP POLICY IF EXISTS "Anon can view online orders" ON online_orders;
CREATE POLICY "Anon can view online orders" ON online_orders
  FOR SELECT TO anon USING (TRUE);

-- Authenticated POS staff can do everything
DROP POLICY IF EXISTS "Authenticated can manage online orders" ON online_orders;
CREATE POLICY "Authenticated can manage online orders" ON online_orders
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Online order items: anon insert
DROP POLICY IF EXISTS "Anon can create order items" ON online_order_items;
CREATE POLICY "Anon can create order items" ON online_order_items
  FOR INSERT TO anon WITH CHECK (TRUE);

-- Online order items: anon read
DROP POLICY IF EXISTS "Anon can view order items" ON online_order_items;
CREATE POLICY "Anon can view order items" ON online_order_items
  FOR SELECT TO anon USING (TRUE);

-- Online order items: authenticated staff full access
DROP POLICY IF EXISTS "Authenticated can manage order items" ON online_order_items;
CREATE POLICY "Authenticated can manage order items" ON online_order_items
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Website visitors can browse approved + online-visible products
DROP POLICY IF EXISTS "Public can read online products" ON products;
CREATE POLICY "Public can read online products" ON products
  FOR SELECT TO anon
  USING (online_visible = TRUE AND approval_status = 'APPROVED' AND is_active = TRUE);

-- ============================================================
-- STEP 9: Grant RPC execute permissions
-- ============================================================

GRANT EXECUTE ON FUNCTION deduct_stock TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_stock TO anon, authenticated;
GRANT EXECUTE ON FUNCTION release_reserved_stock TO anon, authenticated;

-- ============================================================
-- MIGRATION COMPLETE
--
-- Modified tables:
--   invoices            → + sale_channel, online_order_id
--   products            → + online_visible, online_featured,
--                           seo_slug, meta_description, reserved_stock
--   inventory_movements → extended movement_type CHECK constraint
--
-- New tables:
--   online_orders
--   online_order_items
--
-- New RPC functions (call via supabase.rpc()):
--   deduct_stock(product_id, qty, channel, ref, user)
--   reserve_stock(product_id, qty, ref)
--   release_reserved_stock(product_id, qty, ref)
--
-- New view:
--   products_with_availability
--     → available_stock = current_stock - reserved_stock
--     → stock_status: IN_STOCK | LOW_STOCK | OUT_OF_STOCK
--
-- New RLS policies on:
--   online_orders, online_order_items, products (anon read)
-- ============================================================
