-- ============================================================
-- WRAPSTORE — CHANNEL TRACKING MIGRATION
-- database/migration_channel_tracking.sql
--
-- Run this in Supabase SQL Editor AFTER schema_current.sql is live.
-- Does NOT touch RLS settings.
-- ============================================================

-- ============================================================
-- 1. invoices.channel — where the sale originated
-- ============================================================
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'offline'
    CHECK (channel IN ('offline','website','amazon','flipkart','instagram','whatsapp','other'));

-- ============================================================
-- 2. invoices.order_status — fulfilment lifecycle
-- ============================================================
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS order_status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (order_status IN ('pending','confirmed','fulfilled','cancelled'));

-- ============================================================
-- 3. invoices.shipping_address — used for non-offline channels
-- ============================================================
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS shipping_address TEXT;

-- ============================================================
-- 4. inventory_movements.channel — which channel triggered this movement
-- ============================================================
ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'offline'
    CHECK (channel IN ('offline','website','amazon','flipkart','instagram','whatsapp','other'));

-- ============================================================
-- 5. online_sales table
-- Stores manual channel sales (Amazon, Flipkart, Instagram, WhatsApp, Other)
-- logged through the OnlineSales page in the POS.
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS online_sale_id_seq START 1;

CREATE TABLE IF NOT EXISTS online_sales (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_number   TEXT UNIQUE NOT NULL DEFAULT '',     -- WS-ONS-000001
  product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity      INT NOT NULL CHECK (quantity > 0),
  channel       TEXT NOT NULL
                  CHECK (channel IN ('amazon','flipkart','instagram','whatsapp','other')),
  unit_price    NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  total_amount  NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  customer_name TEXT,
  notes         TEXT,
  sale_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_online_sales_product  ON online_sales(product_id);
CREATE INDEX IF NOT EXISTS idx_online_sales_channel  ON online_sales(channel);
CREATE INDEX IF NOT EXISTS idx_online_sales_date     ON online_sales(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_online_sales_created  ON online_sales(created_at DESC);

-- RLS: DISABLED (matches production policy for all tables)
ALTER TABLE online_sales DISABLE ROW LEVEL SECURITY;

-- Auto-generate sale number: WS-ONS-000001
CREATE OR REPLACE FUNCTION generate_online_sale_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sale_number IS NULL OR NEW.sale_number = '' THEN
    NEW.sale_number := 'WS-ONS-' || LPAD(nextval('online_sale_id_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_online_sale_number ON online_sales;
CREATE TRIGGER trigger_online_sale_number
  BEFORE INSERT ON online_sales
  FOR EACH ROW EXECUTE FUNCTION generate_online_sale_number();

DROP TRIGGER IF EXISTS trigger_online_sales_updated_at ON online_sales;
CREATE TRIGGER trigger_online_sales_updated_at
  BEFORE UPDATE ON online_sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 6. Composite index for channel-aware dashboard/reports queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_invoices_channel_status ON invoices(channel, order_status);
CREATE INDEX IF NOT EXISTS idx_invoices_channel_date   ON invoices(channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_movements_channel   ON inventory_movements(channel);

-- ============================================================
-- DONE — Columns added:
--   invoices.channel          TEXT DEFAULT 'offline'
--   invoices.order_status     TEXT DEFAULT 'confirmed'
--   invoices.shipping_address TEXT (nullable)
--   inventory_movements.channel TEXT DEFAULT 'offline'
--
-- Tables created:
--   online_sales (with WS-ONS-XXXXXX auto-number trigger)
-- ============================================================
