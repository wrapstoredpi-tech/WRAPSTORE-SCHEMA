-- ============================================================
-- WRAPSTORE - ADD COLLECTION COLUMN TO PRODUCTS TABLE
-- ============================================================

ALTER TABLE IF EXISTS public.products
ADD COLUMN IF NOT EXISTS collection TEXT;

-- Index for searching and filtering by collection
CREATE INDEX IF NOT EXISTS idx_products_collection ON public.products(collection);
