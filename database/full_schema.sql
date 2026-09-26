-- ============================================================
-- WRAPSTORE COMPLETE DATABASE SCHEMA (ALL STAGES)
-- Execute this entire file in Supabase SQL Editor for new setup
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- SEQUENCES
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS product_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS invoice_id_seq START 1;

-- ============================================================
-- 1. PROFILES (Linked to Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT,
  role          TEXT NOT NULL DEFAULT 'store_manager'
                  CHECK (role IN ('store_manager', 'super_admin')),
  avatar_url    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ============================================================
-- 2. STORE SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS store_settings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_name        TEXT NOT NULL DEFAULT 'WRAPSTORE',
  address           TEXT DEFAULT 'Railway Station Rd, Dharmapuri, Tamil Nadu, India - 636701',
  phone             TEXT DEFAULT '+91 81227 47947',
  gstin             TEXT,
  logo_url          TEXT,
  invoice_prefix    TEXT DEFAULT 'WS',
  invoice_footer    TEXT DEFAULT 'Thank you for shopping at WrapStore!',
  currency          TEXT DEFAULT 'INR',
  currency_symbol   TEXT DEFAULT '₹',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO store_settings (store_name, address, phone)
VALUES ('WRAPSTORE', 'Railway Station Rd, Dharmapuri, Tamil Nadu, India - 636701', '+91 81227 47947')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. CATEGORIES & SUBCATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);

CREATE TABLE IF NOT EXISTS subcategories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  description TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(category_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_active ON subcategories(is_active);

-- ============================================================
-- 4. PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id          TEXT UNIQUE,                    -- WS-000001 (auto-generated)
  name                TEXT NOT NULL,
  product_type        TEXT NOT NULL DEFAULT 'general',
  category_id         UUID REFERENCES categories(id) ON DELETE SET NULL,
  subcategory_id      UUID REFERENCES subcategories(id) ON DELETE SET NULL,
  mobile_brand        TEXT,
  mobile_model        TEXT,
  color_variants      TEXT,
  description         TEXT,
  purchase_price      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
  selling_price       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  gst_percentage      NUMERIC(5,2) NOT NULL DEFAULT 18 CHECK (gst_percentage >= 0),
  current_stock       INT NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  min_stock_level     INT NOT NULL DEFAULT 5 CHECK (min_stock_level >= 0),
  approval_status     TEXT NOT NULL DEFAULT 'PENDING_APPROVAL'
                        CHECK (approval_status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
  rejection_reason    TEXT,
  approved_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at         TIMESTAMPTZ,
  created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_product_id ON products(product_id);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_products_approval ON products(approval_status);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(mobile_brand);
CREATE INDEX IF NOT EXISTS idx_products_model ON products(mobile_model);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(current_stock);

-- Auto-generate product ID (WS-000001)
CREATE OR REPLACE FUNCTION generate_product_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.product_id IS NULL OR NEW.product_id = '' THEN
    NEW.product_id := 'WS-' || LPAD(nextval('product_id_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_product_id ON products;
CREATE TRIGGER trigger_generate_product_id
  BEFORE INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION generate_product_id();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_products_updated_at ON products;
CREATE TRIGGER trigger_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_categories_updated_at ON categories;
CREATE TRIGGER trigger_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_subcategories_updated_at ON subcategories;
CREATE TRIGGER trigger_subcategories_updated_at
  BEFORE UPDATE ON subcategories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_store_settings_updated_at ON store_settings;
CREATE TRIGGER trigger_store_settings_updated_at
  BEFORE UPDATE ON store_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON profiles;
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Product Images
CREATE TABLE IF NOT EXISTS product_images (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url   TEXT,
  is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order   INT NOT NULL DEFAULT 0,
  file_name    TEXT,
  file_size    INT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_primary ON product_images(is_primary);

-- Inventory Movements Audit Log
CREATE TABLE IF NOT EXISTS inventory_movements (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type  TEXT NOT NULL
                   CHECK (movement_type IN (
                     'INITIAL_STOCK',
                     'ADD_STOCK',
                     'REMOVE_STOCK',
                     'MANUAL_ADJUSTMENT',
                     'DAMAGED',
                     'CUSTOMER_RETURN',
                     'SALE'
                   )),
  quantity       INT NOT NULL,
  previous_stock INT NOT NULL,
  new_stock      INT NOT NULL,
  reason         TEXT,
  reference_id   TEXT,
  performed_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inv_movements_date ON inventory_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_movements_user ON inventory_movements(performed_by);

-- ============================================================
-- 5. CUSTOMERS, INVOICES, INVOICE ITEMS & PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  phone        TEXT NOT NULL,
  email        TEXT,
  address      TEXT,
  gstin        TEXT,
  total_orders INT NOT NULL DEFAULT 0,
  total_spent  NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_purchase_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

CREATE TABLE IF NOT EXISTS invoices (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number    TEXT UNIQUE NOT NULL,            -- WS-INV-000001
  customer_id       UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name     TEXT NOT NULL,
  customer_phone    TEXT NOT NULL,
  subtotal          NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  taxable_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  gst_amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  grand_total       NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method    TEXT NOT NULL DEFAULT 'Cash'
                      CHECK (payment_method IN ('Cash', 'UPI', 'Card', 'Other')),
  payment_status    TEXT NOT NULL DEFAULT 'PAID'
                      CHECK (payment_status IN ('PAID', 'PENDING', 'CANCELLED')),
  notes             TEXT,
  pdf_url           TEXT,
  whatsapp_status   TEXT NOT NULL DEFAULT 'PENDING'
                      CHECK (whatsapp_status IN ('PENDING', 'SENT', 'FAILED')),
  whatsapp_sent_at  TIMESTAMPTZ,
  whatsapp_error   TEXT,
  whatsapp_message_id TEXT,
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_whatsapp_status ON invoices(whatsapp_status);

-- Auto-generate invoice number (WS-INV-000001)
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'WS-INV-' || LPAD(nextval('invoice_id_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_invoice_number ON invoices;
CREATE TRIGGER trigger_generate_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION generate_invoice_number();

CREATE TABLE IF NOT EXISTS invoice_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id       UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id       UUID REFERENCES products(id) ON DELETE SET NULL,
  product_id_code  TEXT NOT NULL,
  product_name     TEXT NOT NULL,
  product_type     TEXT NOT NULL,
  mobile_brand     TEXT,
  mobile_model     TEXT,
  quantity         INT NOT NULL CHECK (quantity > 0),
  unit_price       NUMERIC(10,2) NOT NULL,
  discount_pct     NUMERIC(5,2) NOT NULL DEFAULT 0,
  gst_pct          NUMERIC(5,2) NOT NULL DEFAULT 0,
  line_total       NUMERIC(10,2) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_items(product_id);

CREATE TABLE IF NOT EXISTS payments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id     UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount         NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  reference      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);

-- ============================================================
-- 6. WHATSAPP LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id       UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  customer_id      UUID REFERENCES customers(id) ON DELETE SET NULL,
  recipient_phone  TEXT NOT NULL,
  message_body     TEXT NOT NULL,
  pdf_url          TEXT,
  status           TEXT NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
  response_payload JSONB,
  error_message    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_invoice ON whatsapp_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_status ON whatsapp_logs(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created ON whatsapp_logs(created_at DESC);

-- ============================================================
-- 7. SEED DATA: CATEGORIES & SUBCATEGORIES
-- ============================================================
INSERT INTO categories (name, slug, description, sort_order) VALUES
  ('Mobile Cases', 'mobile-cases', 'Protective cases for mobile phones', 1),
  ('Mobile Stickers', 'mobile-stickers', 'Decorative stickers for mobile devices', 2)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO subcategories (category_id, name, slug, description, sort_order)
SELECT c.id, 'iPhone Cases', 'iphone-cases', 'Cases for all iPhone models', 1
FROM categories c WHERE c.slug = 'mobile-cases'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO subcategories (category_id, name, slug, description, sort_order)
SELECT c.id, 'Samsung Premium Cases', 'samsung-premium-cases', 'Premium cases for Samsung Galaxy phones', 2
FROM categories c WHERE c.slug = 'mobile-cases'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO subcategories (category_id, name, slug, description, sort_order)
SELECT c.id, 'Individual Stickers', 'individual-stickers', 'Single sticker designs', 1
FROM categories c WHERE c.slug = 'mobile-stickers'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO subcategories (category_id, name, slug, description, sort_order)
SELECT c.id, 'Sticker Sets', 'sticker-sets', 'Curated sticker collections and packs', 2
FROM categories c WHERE c.slug = 'mobile-stickers'
ON CONFLICT (category_id, slug) DO NOTHING;

-- ============================================================
-- 8. AUTO-CREATE PROFILE TRIGGER FOR NEW SUPABASE AUTH USERS
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE 
      WHEN NEW.raw_user_meta_data->>'role' IN ('store_manager', 'super_admin') 
      THEN NEW.raw_user_meta_data->>'role'
      ELSE 'store_manager'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
CREATE POLICY "Super admins can view all profiles" ON profiles FOR SELECT USING (get_user_role() = 'super_admin');

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid());

-- Store Settings Policies
DROP POLICY IF EXISTS "Authenticated users can read settings" ON store_settings;
CREATE POLICY "Authenticated users can read settings" ON store_settings FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Super admin can update settings" ON store_settings;
CREATE POLICY "Super admin can update settings" ON store_settings FOR UPDATE USING (get_user_role() IN ('super_admin', 'store_manager'));

DROP POLICY IF EXISTS "Super admin can insert settings" ON store_settings;
CREATE POLICY "Super admin can insert settings" ON store_settings FOR INSERT WITH CHECK (get_user_role() = 'super_admin');

-- Categories Policies
DROP POLICY IF EXISTS "Authenticated can read categories" ON categories;
CREATE POLICY "Authenticated can read categories" ON categories FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Authenticated can manage categories" ON categories;
CREATE POLICY "Authenticated can manage categories" ON categories FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Subcategories Policies
DROP POLICY IF EXISTS "Authenticated can read subcategories" ON subcategories;
CREATE POLICY "Authenticated can read subcategories" ON subcategories FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Authenticated can manage subcategories" ON subcategories;
CREATE POLICY "Authenticated can manage subcategories" ON subcategories FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Products Policies
DROP POLICY IF EXISTS "Authenticated can read products" ON products;
CREATE POLICY "Authenticated can read products" ON products FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Authenticated can insert products" ON products;
CREATE POLICY "Authenticated can insert products" ON products FOR INSERT TO authenticated WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Creators can update own products" ON products;
CREATE POLICY "Creators can update own products" ON products FOR UPDATE TO authenticated USING (created_by = auth.uid() OR get_user_role() IN ('super_admin'));

DROP POLICY IF EXISTS "Super admin can update any product" ON products;
CREATE POLICY "Super admin can update any product" ON products FOR UPDATE USING (get_user_role() = 'super_admin');

DROP POLICY IF EXISTS "Super admin can delete products" ON products;
CREATE POLICY "Super admin can delete products" ON products FOR DELETE USING (get_user_role() = 'super_admin');

-- Product Images Policies
DROP POLICY IF EXISTS "Authenticated can manage product images" ON product_images;
CREATE POLICY "Authenticated can manage product images" ON product_images FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Inventory Movements Policies
DROP POLICY IF EXISTS "Authenticated can read inventory movements" ON inventory_movements;
CREATE POLICY "Authenticated can read inventory movements" ON inventory_movements FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Authenticated can insert inventory movements" ON inventory_movements;
CREATE POLICY "Authenticated can insert inventory movements" ON inventory_movements FOR INSERT TO authenticated WITH CHECK (TRUE);

-- Customers Policies
DROP POLICY IF EXISTS "Authenticated can manage customers" ON customers;
CREATE POLICY "Authenticated can manage customers" ON customers FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Invoices Policies
DROP POLICY IF EXISTS "Authenticated can manage invoices" ON invoices;
CREATE POLICY "Authenticated can manage invoices" ON invoices FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Invoice Items Policies
DROP POLICY IF EXISTS "Authenticated can manage invoice items" ON invoice_items;
CREATE POLICY "Authenticated can manage invoice items" ON invoice_items FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Payments Policies
DROP POLICY IF EXISTS "Authenticated can manage payments" ON payments;
CREATE POLICY "Authenticated can manage payments" ON payments FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- WhatsApp Logs Policies
DROP POLICY IF EXISTS "Authenticated can read whatsapp logs" ON whatsapp_logs;
CREATE POLICY "Authenticated can read whatsapp logs" ON whatsapp_logs FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Authenticated can insert whatsapp logs" ON whatsapp_logs;
CREATE POLICY "Authenticated can insert whatsapp logs" ON whatsapp_logs FOR INSERT TO authenticated WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Super admin can manage whatsapp logs" ON whatsapp_logs;
CREATE POLICY "Super admin can manage whatsapp logs" ON whatsapp_logs FOR ALL USING (get_user_role() = 'super_admin');
