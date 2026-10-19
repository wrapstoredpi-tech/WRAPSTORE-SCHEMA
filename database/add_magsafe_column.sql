-- ============================================================
-- WRAPSTORE - ADD MAGSAFE COLUMN TO PRODUCTS TABLE
-- ============================================================

ALTER TABLE IF EXISTS public.products
ADD COLUMN IF NOT EXISTS magsafe BOOLEAN DEFAULT FALSE;

-- Index for searching and filtering by magsafe
CREATE INDEX IF NOT EXISTS idx_products_magsafe ON public.products(magsafe);
