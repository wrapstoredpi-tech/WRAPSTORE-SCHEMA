-- ============================================================
-- ADD PRODUCT_ID COLUMN & SEQUENCE FOR ACCESSORIES TABLE
-- Generates persistent product_id series: WS-ACC-000001, WS-ACC-000002...
-- Run this script in Supabase Dashboard -> SQL Editor
-- ============================================================

-- 1. Create sequence for Accessories product_id
CREATE SEQUENCE IF NOT EXISTS accessory_product_id_seq START 1;

-- 2. Add product_id column to accessories table if not exists
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS product_id TEXT UNIQUE;

-- 3. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_accessories_product_id ON accessories(product_id);

-- 4. Create trigger function to auto-generate product_id before insert
CREATE OR REPLACE FUNCTION generate_accessory_product_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.product_id IS NULL OR NEW.product_id = '' THEN
    NEW.product_id := 'WS-ACC-' || LPAD(nextval('accessory_product_id_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Attach BEFORE INSERT trigger on accessories
DROP TRIGGER IF EXISTS trigger_generate_accessory_product_id ON accessories;
CREATE TRIGGER trigger_generate_accessory_product_id
  BEFORE INSERT ON accessories
  FOR EACH ROW EXECUTE FUNCTION generate_accessory_product_id();

-- 6. Backfill product_id for existing accessories rows where product_id is NULL
UPDATE accessories
SET product_id = 'WS-ACC-' || LPAD(nextval('accessory_product_id_seq')::TEXT, 6, '0')
WHERE product_id IS NULL OR product_id = '';

-- 7. Ensure sequence position is safely aligned past any existing numeric suffix
SELECT setval('accessory_product_id_seq', COALESCE((
  SELECT MAX(NULLIF(regexp_replace(product_id, '^WS-ACC-', ''), ''))::bigint
  FROM accessories
  WHERE product_id ~ '^WS-ACC-[0-9]+$'
), 0) + 1, false);
