-- ============================================================
-- WRAPSTORE - ADD STRAP_MM COLUMN TO PRODUCTS TABLE
-- ============================================================

ALTER TABLE IF EXISTS public.products
ADD COLUMN IF NOT EXISTS strap_mm TEXT;

-- Index for searching and filtering by strap_mm
CREATE INDEX IF NOT EXISTS idx_products_strap_mm ON public.products(strap_mm);
