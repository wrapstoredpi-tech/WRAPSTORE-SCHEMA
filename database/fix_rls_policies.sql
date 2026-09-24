-- ============================================================
-- FIX RLS POLICIES FOR WRAPSTORE SUPABASE DATABASE
-- Run this in your Supabase Dashboard -> SQL Editor
-- ============================================================

-- Disable RLS on core tables so full CRUD operations work
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

-- ============================================================
-- SUPABASE STORAGE POLICIES & CLEANUP FOR product-images BUCKET
-- ============================================================
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
      AND role IN ('super_admin', 'store_manager')
      AND is_active = TRUE
  );
$$;

REVOKE ALL ON FUNCTION private.is_admin(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_admin(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION private.is_admin(UUID) TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access for Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Public Select product-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read product images" ON storage.objects;

DROP POLICY IF EXISTS "Public Upload Access for Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Public Update Access for Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete Access for Product Images" ON storage.objects;

DROP POLICY IF EXISTS "Admin upload product images" ON storage.objects;
CREATE POLICY "Admin upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images' AND
    private.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admin update product images" ON storage.objects;
CREATE POLICY "Admin update product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images' AND
    private.is_admin(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'product-images' AND
    private.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admin delete product images" ON storage.objects;
CREATE POLICY "Admin delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images' AND
    private.is_admin(auth.uid())
  );
