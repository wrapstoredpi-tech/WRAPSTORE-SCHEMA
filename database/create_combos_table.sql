-- ============================================================
-- WRAPSTORE - DATABASE MIGRATION: CREATE COMBOS & COMBO_ITEMS TABLES
-- Run this script in your Supabase Dashboard -> SQL Editor:
-- https://supabase.com/dashboard/project/ppwpedkqlgjvdosxabtf/sql/new
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sequence for unique combo codes (WS-CMB-1001, WS-CMB-1002...)
CREATE SEQUENCE IF NOT EXISTS combo_code_seq START 1001;

-- 1. Main COMBOS Table
CREATE TABLE IF NOT EXISTS public.combos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  combo_code      TEXT NOT NULL UNIQUE DEFAULT ('WS-CMB-' || nextval('combo_code_seq')::text),
  code            TEXT,
  name            TEXT NOT NULL,
  description     TEXT,
  selling_price   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  original_value  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (original_value >= 0),
  items           JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to keep `code` and `combo_code` synchronized
CREATE OR REPLACE FUNCTION public.sync_combo_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := NEW.combo_code;
  END IF;
  IF NEW.combo_code IS NULL THEN
    NEW.combo_code := NEW.code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_combo_code ON public.combos;
CREATE TRIGGER trigger_sync_combo_code
BEFORE INSERT OR UPDATE ON public.combos
FOR EACH ROW EXECUTE FUNCTION public.sync_combo_code();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_combos_code ON public.combos(combo_code);
CREATE INDEX IF NOT EXISTS idx_combos_active ON public.combos(is_active);
CREATE INDEX IF NOT EXISTS idx_combos_created_at ON public.combos(created_at DESC);

-- 2. COMBOS ITEMS Table (Normalized product breakdown for relational queries)
CREATE TABLE IF NOT EXISTS public.combo_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  combo_id        UUID NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name    TEXT NOT NULL,
  product_code    TEXT,
  mobile_model    TEXT,
  allotted_qty    INT NOT NULL DEFAULT 1 CHECK (allotted_qty > 0),
  unit_price      NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_combo_items_combo ON public.combo_items(combo_id);
CREATE INDEX IF NOT EXISTS idx_combo_items_product ON public.combo_items(product_id);

-- 3. Compatibility alias view 'combo' pointing to 'combos'
CREATE OR REPLACE VIEW public.combo 
WITH (security_invoker = true) AS 
SELECT * FROM public.combos;

-- 4. Permissions & RLS Configuration (Disabled per production standard)
ALTER TABLE public.combos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_items DISABLE ROW LEVEL SECURITY;

-- Fallback open policies in case RLS is kept enabled by Supabase
DROP POLICY IF EXISTS "Allow full access on combos" ON public.combos;
CREATE POLICY "Allow full access on combos" ON public.combos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access on combo_items" ON public.combo_items;
CREATE POLICY "Allow full access on combo_items" ON public.combo_items FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.combos TO authenticated, anon, service_role;
GRANT ALL ON public.combo_items TO authenticated, anon, service_role;
GRANT ALL ON public.combo TO authenticated, anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE combo_code_seq TO authenticated, anon, service_role;

-- 5. Realtime Publication (allows live sync across store dashboards)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.combos;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;
