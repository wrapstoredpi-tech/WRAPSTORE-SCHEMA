-- ============================================================
-- SECURE SUPABASE STORAGE POLICIES FOR 'product-images' BUCKET
-- Run this script in Supabase Dashboard -> SQL Editor
-- ============================================================

-- 1. Create dedicated private schema for internal helper functions
CREATE SCHEMA IF NOT EXISTS private;

-- 2. Create SECURITY DEFINER helper function in private schema to check admin/manager roles
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

-- 3. Restrict function execution: Revoke from PUBLIC and anon, grant to authenticated
REVOKE ALL ON FUNCTION private.is_admin(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_admin(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION private.is_admin(UUID) TO authenticated;

-- 4. Ensure product-images storage bucket is PUBLIC (for direct CDN image URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

-- 5. Drop broad SELECT policies (removes directory listing vulnerability & dashboard warning)
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access for Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Public Select product-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read product images" ON storage.objects;

-- 6. Drop unauthenticated / broad write policies
DROP POLICY IF EXISTS "Public Upload Access for Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Public Update Access for Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete Access for Product Images" ON storage.objects;

-- 7. INSERT Policy (Restricted to authenticated super_admin & store_manager)
DROP POLICY IF EXISTS "Admin upload product images" ON storage.objects;
CREATE POLICY "Admin upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images' AND
    private.is_admin(auth.uid())
  );

-- 8. UPDATE Policy (Restricted to authenticated super_admin & store_manager, supporting upsert:true)
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

-- 9. DELETE Policy (Restricted to authenticated super_admin & store_manager)
DROP POLICY IF EXISTS "Admin delete product images" ON storage.objects;
CREATE POLICY "Admin delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images' AND
    private.is_admin(auth.uid())
  );
