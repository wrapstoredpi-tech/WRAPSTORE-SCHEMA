-- ============================================================
-- WRAPSTORE - DATABASE MIGRATION: UPDATE GST & DISCOUNT DEFAULTS
-- Run this script in your Supabase Dashboard -> SQL Editor
-- (https://supabase.com/dashboard/project/ppwpedkqlgjvdosxabtf/sql/new)
-- ============================================================

-- 1. Change the default GST percentage for products table from 18% to 0%
ALTER TABLE public.products 
ALTER COLUMN gst_percentage SET DEFAULT 0;

-- 2. Update all existing products in DB with 18% GST to 0% GST
UPDATE public.products 
SET gst_percentage = 0 
WHERE gst_percentage = 18 OR gst_percentage IS NULL;

-- 3. Verify the changes
SELECT id, name, product_id, selling_price, gst_percentage 
FROM public.products 
ORDER BY created_at DESC;
