-- ============================================================
-- WRAPSTORE - DATABASE MIGRATION: ADD MRP COLUMN TO PRODUCTS
-- Run this script in your Supabase Dashboard -> SQL Editor:
-- https://supabase.com/dashboard/project/ppwpedkqlgjvdosxabtf/sql/new
-- ============================================================

-- 1. Add mrp column to public.products table if it does not exist
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS mrp NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (mrp >= 0);

-- 2. Backfill mrp column for existing products by extracting from description text (e.g. 'MRP: ₹599' or 'MRP: ₹499')
UPDATE public.products
SET mrp = CAST(
  regexp_replace(
    substring(description from 'MRP:\s*₹?\s*([0-9.]+)'),
    '[^0-9.]', '', 'g'
  ) AS NUMERIC(10,2)
)
WHERE description LIKE '%MRP%' 
  AND (mrp IS NULL OR mrp = 0);

-- 3. Verify updated products
SELECT id, product_id, name, purchase_price, selling_price, mrp, color_variants, description
FROM public.products
ORDER BY created_at DESC;
