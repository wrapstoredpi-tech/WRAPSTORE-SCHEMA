-- ============================================================
-- WRAPSTORE ACCESSORIES DATABASE MIGRATION (CORRECTED)
-- Isolated database architecture for Accessories category
-- Does NOT touch or modify existing Mobile Cases tables/flow
-- ============================================================

-- 1. MOBILE MODELS TABLE (Master table for Accessories compatibility)
CREATE TABLE IF NOT EXISTS mobile_models (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand       VARCHAR(50) NOT NULL,
  model_name  VARCHAR(100) NOT NULL UNIQUE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_models_brand ON mobile_models(brand);
CREATE INDEX IF NOT EXISTS idx_mobile_models_is_active ON mobile_models(is_active);

-- 2. ACCESSORIES TABLE
CREATE SEQUENCE IF NOT EXISTS accessory_product_id_seq START 1;

CREATE TABLE IF NOT EXISTS accessories (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         TEXT UNIQUE,
  category_id        UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  subcategory_id     UUID NOT NULL REFERENCES subcategories(id) ON DELETE RESTRICT,
  brand_name         VARCHAR(100),
  product_name       VARCHAR(255) NOT NULL,
  description        TEXT,
  compatibility_type VARCHAR(20) NOT NULL
                       CHECK (compatibility_type IN ('apple', 'samsung', 'universal')),
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accessories_product_id ON accessories(product_id);
CREATE INDEX IF NOT EXISTS idx_accessories_category_id ON accessories(category_id);
CREATE INDEX IF NOT EXISTS idx_accessories_subcategory_id ON accessories(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_accessories_brand_name ON accessories(brand_name);
CREATE INDEX IF NOT EXISTS idx_accessories_is_active ON accessories(is_active);

CREATE OR REPLACE FUNCTION generate_accessory_product_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.product_id IS NULL OR NEW.product_id = '' THEN
    NEW.product_id := 'WS-ACC-' || LPAD(nextval('accessory_product_id_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_accessory_product_id ON accessories;
CREATE TRIGGER trigger_generate_accessory_product_id
  BEFORE INSERT ON accessories
  FOR EACH ROW EXECUTE FUNCTION generate_accessory_product_id();

-- 3. ACCESSORY COMPATIBLE MODELS TABLE
CREATE TABLE IF NOT EXISTS accessory_compatible_models (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accessory_id UUID NOT NULL REFERENCES accessories(id) ON DELETE CASCADE,
  model_id     UUID NOT NULL REFERENCES mobile_models(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(accessory_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_accessory_compatible_models_accessory_id ON accessory_compatible_models(accessory_id);
CREATE INDEX IF NOT EXISTS idx_accessory_compatible_models_model_id ON accessory_compatible_models(model_id);

-- 4. ACCESSORY VARIANTS TABLE
CREATE TABLE IF NOT EXISTS accessory_variants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accessory_id  UUID NOT NULL REFERENCES accessories(id) ON DELETE CASCADE,
  sku           VARCHAR(100) UNIQUE,
  variant_name  VARCHAR(255) NOT NULL,
  description   TEXT,
  attributes    JSONB NOT NULL DEFAULT '{}'::jsonb,
  mrp           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (mrp >= 0),
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  quantity      INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accessory_variants_accessory_id ON accessory_variants(accessory_id);
CREATE INDEX IF NOT EXISTS idx_accessory_variants_sku ON accessory_variants(sku);
CREATE INDEX IF NOT EXISTS idx_accessory_variants_is_active ON accessory_variants(is_active);

-- 5. ACCESSORY VARIANT IMAGES TABLE
CREATE TABLE IF NOT EXISTS accessory_variant_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id    UUID NOT NULL REFERENCES accessory_variants(id) ON DELETE CASCADE,
  image_url     TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accessory_variant_images_variant_id ON accessory_variant_images(variant_id);

-- 6. ACCESSORIES-SPECIFIC UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION update_accessory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_accessories_updated_at ON accessories;
CREATE TRIGGER trigger_accessories_updated_at
  BEFORE UPDATE ON accessories
  FOR EACH ROW EXECUTE FUNCTION update_accessory_updated_at();

DROP TRIGGER IF EXISTS trigger_accessory_variants_updated_at ON accessory_variants;
CREATE TRIGGER trigger_accessory_variants_updated_at
  BEFORE UPDATE ON accessory_variants
  FOR EACH ROW EXECUTE FUNCTION update_accessory_updated_at();

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE mobile_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessories ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessory_compatible_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessory_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessory_variant_images ENABLE ROW LEVEL SECURITY;

-- Read policies (Public / Authenticated SELECT)
DROP POLICY IF EXISTS "Anyone can view mobile models" ON mobile_models;
CREATE POLICY "Anyone can view mobile models" ON mobile_models FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Anyone can view accessories" ON accessories;
CREATE POLICY "Anyone can view accessories" ON accessories FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Anyone can view accessory compatible models" ON accessory_compatible_models;
CREATE POLICY "Anyone can view accessory compatible models" ON accessory_compatible_models FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Anyone can view accessory variants" ON accessory_variants;
CREATE POLICY "Anyone can view accessory variants" ON accessory_variants FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Anyone can view accessory variant images" ON accessory_variant_images;
CREATE POLICY "Anyone can view accessory variant images" ON accessory_variant_images FOR SELECT USING (TRUE);

-- Management policies (Restricted to super_admin and store_manager roles)
DROP POLICY IF EXISTS "Authorized roles can manage mobile models" ON mobile_models;
CREATE POLICY "Authorized roles can manage mobile models" ON mobile_models
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'store_manager') AND is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'store_manager') AND is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "Authorized roles can manage accessories" ON accessories;
CREATE POLICY "Authorized roles can manage accessories" ON accessories
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'store_manager') AND is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'store_manager') AND is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "Authorized roles can manage accessory compatible models" ON accessory_compatible_models;
CREATE POLICY "Authorized roles can manage accessory compatible models" ON accessory_compatible_models
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'store_manager') AND is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'store_manager') AND is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "Authorized roles can manage accessory variants" ON accessory_variants;
CREATE POLICY "Authorized roles can manage accessory variants" ON accessory_variants
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'store_manager') AND is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'store_manager') AND is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "Authorized roles can manage accessory variant images" ON accessory_variant_images;
CREATE POLICY "Authorized roles can manage accessory variant images" ON accessory_variant_images
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'store_manager') AND is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'store_manager') AND is_active = TRUE
    )
  );

-- 8. INITIAL SEED DATA FOR MOBILE MODELS MASTER TABLE
INSERT INTO mobile_models (brand, model_name) VALUES
  ('Apple', 'iPhone 18 Pro Max'),
  ('Apple', 'iPhone 18 Pro'),
  ('Apple', 'iPhone 18 Plus'),
  ('Apple', 'iPhone 18'),
  ('Apple', 'iPhone 17 Pro Max'),
  ('Apple', 'iPhone 17 Pro'),
  ('Apple', 'iPhone 17 Plus'),
  ('Apple', 'iPhone 17'),
  ('Apple', 'iPhone 16 Pro Max'),
  ('Apple', 'iPhone 16 Pro'),
  ('Apple', 'iPhone 16 Plus'),
  ('Apple', 'iPhone 16'),
  ('Apple', 'iPhone 15 Pro Max'),
  ('Apple', 'iPhone 15 Pro'),
  ('Apple', 'iPhone 15 Plus'),
  ('Apple', 'iPhone 15'),
  ('Apple', 'iPhone 14 Pro Max'),
  ('Apple', 'iPhone 14 Pro'),
  ('Apple', 'iPhone 14 Plus'),
  ('Apple', 'iPhone 14'),
  ('Apple', 'iPhone 13 Pro Max'),
  ('Apple', 'iPhone 13 Pro'),
  ('Apple', 'iPhone 13 Mini'),
  ('Apple', 'iPhone 13'),
  ('Samsung', 'Samsung Galaxy S25 Ultra'),
  ('Samsung', 'Samsung Galaxy S25+'),
  ('Samsung', 'Samsung Galaxy S25'),
  ('Samsung', 'Samsung Galaxy S24 Ultra'),
  ('Samsung', 'Samsung Galaxy S24+'),
  ('Samsung', 'Samsung Galaxy S24')
ON CONFLICT (model_name) DO NOTHING;
