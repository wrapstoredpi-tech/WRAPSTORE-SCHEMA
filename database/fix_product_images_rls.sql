-- ============================================================
-- FIX RLS ON product_images TABLE & STORAGE
-- Run this script in Supabase Dashboard -> SQL Editor
-- ============================================================

-- 1. Enable RLS on product_images and add full management policies
ALTER TABLE IF EXISTS public.product_images ENABLE ROW LEVEL SECURITY;

-- 2. Drop any restrictive existing policies
DROP POLICY IF EXISTS "Authenticated can manage product images" ON public.product_images;
DROP POLICY IF EXISTS "Allow full access on product_images" ON public.product_images;
DROP POLICY IF EXISTS "Public can manage product images" ON public.product_images;
DROP POLICY IF EXISTS "Public can read product images" ON public.product_images;
DROP POLICY IF EXISTS "Public can view product images" ON public.product_images;
DROP POLICY IF EXISTS "Allow admin full access on product images" ON public.product_images;

-- 3. Create open policies for full access (covers SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Public can view product images"
  ON public.product_images FOR SELECT
  USING (true);

CREATE POLICY "Allow admin full access on product images"
  ON public.product_images FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Set security invoker on the combo view (removes UNRESTRICTED badge from the view)
ALTER VIEW IF EXISTS public.combos_with_availability SET (security_invoker = true);

-- 4. Ensure storage bucket product-images exists and has open permissions
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

DROP POLICY IF EXISTS "Allow all on product-images storage" ON storage.objects;
CREATE POLICY "Allow all on product-images storage"
  ON storage.objects FOR ALL
  USING (bucket_id = 'product-images')
  WITH CHECK (bucket_id = 'product-images');

-- 5. Drop any legacy triggers on product_images that attempt direct SQL deletion from storage.objects
-- (Direct deletion from storage tables is blocked by Supabase; deletion must happen via Storage API)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_schema = 'public' 
          AND event_object_table = 'product_images'
    ) LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON public.product_images CASCADE;';
    END LOOP;
END $$;

