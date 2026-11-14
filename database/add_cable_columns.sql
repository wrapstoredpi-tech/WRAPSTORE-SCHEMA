-- ============================================================
-- WRAPSTORE - ADD PIN_TYPE & CABLE_TYPE COLUMNS TO PRODUCTS
-- ============================================================

ALTER TABLE IF EXISTS public.products
ADD COLUMN IF NOT EXISTS pin_type TEXT,
ADD COLUMN IF NOT EXISTS cable_type TEXT;

-- Create indexes for filtering and searching
CREATE INDEX IF NOT EXISTS idx_products_pin_type ON public.products(pin_type);
CREATE INDEX IF NOT EXISTS idx_products_cable_type ON public.products(cable_type);

