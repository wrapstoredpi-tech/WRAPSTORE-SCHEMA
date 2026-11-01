-- ============================================================
-- WRAPSTORE - ADD DEDICATED COMBO IMAGES COLUMN
-- Allows combos to have a representative hero image / banner
-- displayed on the website catalog and product cards
-- ============================================================

ALTER TABLE public.combos
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- Grant permissions to authenticated, anon, and service_role
GRANT ALL ON public.combos TO authenticated, anon, service_role;

