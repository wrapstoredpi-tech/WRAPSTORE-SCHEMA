-- ============================================================
-- FIX STORAGE RLS FOR product-images BUCKET
-- Run this script in Supabase Dashboard -> SQL Editor
-- ============================================================

-- 1. Ensure product-images storage bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

-- 2. Drop restrictive or failing storage policies on storage.objects
DROP POLICY IF EXISTS "Admin upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Admin update product images" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload Access for Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Public Update Access for Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete Access for Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Allow upload to product-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow update on product-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow select on product-images" ON storage.objects;

-- 3. Create open upload/read policies for product-images bucket
CREATE POLICY "Allow select on product-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "Allow upload to product-images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Allow update on product-images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images')
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Allow delete on product-images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images');
