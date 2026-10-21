-- ============================================================
-- WRAPSTORE - ADD MAH COLUMN TO PRODUCTS TABLE
-- ============================================================

ALTER TABLE IF EXISTS public.products
ADD COLUMN IF NOT EXISTS mah TEXT;

-- Index for searching and filtering by mah
CREATE INDEX IF NOT EXISTS idx_products_mah ON public.products(mah);
