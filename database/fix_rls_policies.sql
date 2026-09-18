-- ============================================================
-- FIX RLS POLICIES FOR WRAPSTORE SUPABASE DATABASE
-- Run this in your Supabase Dashboard -> SQL Editor
-- ============================================================

-- Disable RLS on categories and subcategories so full CRUD operations work
ALTER TABLE IF EXISTS categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subcategories DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS product_images DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoice_items DISABLE ROW LEVEL SECURITY;

-- Alternatively, create open policies if RLS remains enabled
DROP POLICY IF EXISTS "Allow full access on categories" ON categories;
CREATE POLICY "Allow full access on categories" ON categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access on subcategories" ON subcategories;
CREATE POLICY "Allow full access on subcategories" ON subcategories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access on products" ON products;
CREATE POLICY "Allow full access on products" ON products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access on inventory_movements" ON inventory_movements;
CREATE POLICY "Allow full access on inventory_movements" ON inventory_movements FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access on product_images" ON product_images;
CREATE POLICY "Allow full access on product_images" ON product_images FOR ALL USING (true) WITH CHECK (true);
