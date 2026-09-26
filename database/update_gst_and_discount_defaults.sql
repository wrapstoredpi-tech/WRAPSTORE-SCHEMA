-- ============================================================
-- WRAPSTORE - DATABASE MIGRATION: UPDATE GST & DISCOUNT DEFAULTS
-- Run this script in your Supabase Dashboard -> SQL Editor
-- (https://supabase.com/dashboard/project/ppwpedkqlgjvdosxabtf/sql/new)
-- ============================================================

-- 1. Ensure the default GST percentage for products table is 18%
ALTER TABLE public.products 
ALTER COLUMN gst_percentage SET DEFAULT 18;

-- 2. Update existing products in DB to 18% GST
UPDATE public.products 
SET gst_percentage = 18 
WHERE gst_percentage IS NULL OR gst_percentage = 0;

-- 3. Verify the changes
SELECT id, name, product_id, selling_price, gst_percentage 
FROM public.products 
ORDER BY created_at DESC;
