-- ============================================================
-- WRAPSTORE - ADD COLOUR VARIANTS FOR SPECIFIC ACCESSORY SUBCATEGORIES
-- Subcategories: Power Bank, Watch Strap, Ipad Case, Cables,
-- Airpods Cases, Wallet, Watch Cases, Phone Stand, Adapters, Lens Protector
-- ============================================================

-- Disable RLS temporarily or ensure full access policy for local dev
ALTER TABLE IF EXISTS accessories DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS accessory_variants DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS accessory_compatible_models DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS accessory_variant_images DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_cat_id UUID;
  v_sub_power_bank UUID;
  v_sub_watch_strap UUID;
  v_sub_ipad_case UUID;
  v_sub_cables UUID;
  v_sub_airpods UUID;
  v_sub_wallet UUID;
  v_sub_watch_cases UUID;
  v_sub_phone_stand UUID;
  v_sub_adapters UUID;
  v_sub_lens UUID;

  v_acc_power_bank UUID;
  v_acc_watch_strap UUID;
  v_acc_ipad_case UUID;
  v_acc_cables UUID;
  v_acc_airpods UUID;
  v_acc_wallet UUID;
  v_acc_watch_cases UUID;
  v_acc_phone_stand UUID;
  v_acc_adapters UUID;
  v_acc_lens UUID;
BEGIN
  -- Fetch Accessories Category ID
  SELECT id INTO v_cat_id FROM categories WHERE slug = 'accessories' OR name ILIKE '%access%' LIMIT 1;
  IF v_cat_id IS NULL THEN
    INSERT INTO categories (name, slug, sort_order, is_active)
    VALUES ('Accessories', 'accessories', 1, TRUE)
    RETURNING id INTO v_cat_id;
  END IF;

  -- 1. Power Bank Subcategory & Accessories
  SELECT id INTO v_sub_power_bank FROM subcategories WHERE name ILIKE '%Power Bank%' LIMIT 1;
  IF v_sub_power_bank IS NOT NULL THEN
    INSERT INTO accessories (category_id, subcategory_id, brand_name, product_name, description, compatibility_type, is_active)
    VALUES (v_cat_id, v_sub_power_bank, 'Lito', 'Magnetic Wireless Power Bank', '10000mAh Ultra Thin Magnetic Power Bank', 'universal', TRUE)
    RETURNING id INTO v_acc_power_bank;

    INSERT INTO accessory_variants (accessory_id, variant_name, description, attributes, mrp, selling_price, quantity, is_active) VALUES
      (v_acc_power_bank, 'Magnetic Wireless Power Bank - Black', '10000mAh Power Bank', '{"color": "Black"}'::jsonb, 4999, 3299, 15, TRUE),
      (v_acc_power_bank, 'Magnetic Wireless Power Bank - White', '10000mAh Power Bank', '{"color": "White"}'::jsonb, 4999, 3299, 12, TRUE),
      (v_acc_power_bank, 'Magnetic Wireless Power Bank - Navy Blue', '10000mAh Power Bank', '{"color": "Navy Blue"}'::jsonb, 4999, 3299, 10, TRUE);
  END IF;

  -- 2. Watch Strap Subcategory & Accessories
  SELECT id INTO v_sub_watch_strap FROM subcategories WHERE name ILIKE '%Watch Strap%' LIMIT 1;
  IF v_sub_watch_strap IS NOT NULL THEN
    INSERT INTO accessories (category_id, subcategory_id, brand_name, product_name, description, compatibility_type, is_active)
    VALUES (v_cat_id, v_sub_watch_strap, 'Spigen', 'Alpine Loop Watch Strap', 'Durable nylon weave strap for Smartwatches', 'universal', TRUE)
    RETURNING id INTO v_acc_watch_strap;

    INSERT INTO accessory_variants (accessory_id, variant_name, description, attributes, mrp, selling_price, quantity, is_active) VALUES
      (v_acc_watch_strap, 'Alpine Loop Watch Strap - Orange', 'Nylon Watch Strap', '{"color": "Orange"}'::jsonb, 1499, 899, 25, TRUE),
      (v_acc_watch_strap, 'Alpine Loop Watch Strap - Starlight', 'Nylon Watch Strap', '{"color": "Starlight"}'::jsonb, 1499, 899, 20, TRUE),
      (v_acc_watch_strap, 'Alpine Loop Watch Strap - Black', 'Nylon Watch Strap', '{"color": "Black"}'::jsonb, 1499, 899, 30, TRUE);
  END IF;

  -- 3. iPad Case Subcategory & Accessories
  SELECT id INTO v_sub_ipad_case FROM subcategories WHERE name ILIKE '%Ipad Case%' LIMIT 1;
  IF v_sub_ipad_case IS NOT NULL THEN
    INSERT INTO accessories (category_id, subcategory_id, brand_name, product_name, description, compatibility_type, is_active)
    VALUES (v_cat_id, v_sub_ipad_case, 'ESR', 'Magnetic Smart Folio iPad Case', 'Trifold stand magnetic protective case for iPad', 'apple', TRUE)
    RETURNING id INTO v_acc_ipad_case;

    INSERT INTO accessory_variants (accessory_id, variant_name, description, attributes, mrp, selling_price, quantity, is_active) VALUES
      (v_acc_ipad_case, 'Magnetic Smart Folio Case - Black', 'iPad Folio Case', '{"color": "Black"}'::jsonb, 2499, 1599, 18, TRUE),
      (v_acc_ipad_case, 'Magnetic Smart Folio Case - Denim Blue', 'iPad Folio Case', '{"color": "Denim Blue"}'::jsonb, 2499, 1599, 15, TRUE),
      (v_acc_ipad_case, 'Magnetic Smart Folio Case - Lavender', 'iPad Folio Case', '{"color": "Lavender"}'::jsonb, 2499, 1599, 12, TRUE);
  END IF;

  -- 4. Cables Subcategory & Accessories
  SELECT id INTO v_sub_cables FROM subcategories WHERE name ILIKE '%Cable%' LIMIT 1;
  IF v_sub_cables IS NOT NULL THEN
    INSERT INTO accessories (category_id, subcategory_id, brand_name, product_name, description, compatibility_type, is_active)
    VALUES (v_cat_id, v_sub_cables, 'Anker', 'Braided Type-C Fast Charging Cable', '60W PD Fast Charging Nylon Braided Cable 1m', 'universal', TRUE)
    RETURNING id INTO v_acc_cables;

    INSERT INTO accessory_variants (accessory_id, variant_name, description, attributes, mrp, selling_price, quantity, is_active) VALUES
      (v_acc_cables, 'Braided Type-C Fast Charging Cable - Black', 'Type-C Cable', '{"color": "Black"}'::jsonb, 999, 599, 40, TRUE),
      (v_acc_cables, 'Braided Type-C Fast Charging Cable - Red', 'Type-C Cable', '{"color": "Red"}'::jsonb, 999, 599, 35, TRUE),
      (v_acc_cables, 'Braided Type-C Fast Charging Cable - Silver', 'Type-C Cable', '{"color": "Silver"}'::jsonb, 999, 599, 25, TRUE);
  END IF;

  -- 5. Airpods Cases Subcategory & Accessories
  SELECT id INTO v_sub_airpods FROM subcategories WHERE name ILIKE '%Airpods%' LIMIT 1;
  IF v_sub_airpods IS NOT NULL THEN
    INSERT INTO accessories (category_id, subcategory_id, brand_name, product_name, description, compatibility_type, is_active)
    VALUES (v_cat_id, v_sub_airpods, 'Caseology', 'Silicone Protective AirPods Case', 'Shock-resistant soft silicone case with carabiner', 'apple', TRUE)
    RETURNING id INTO v_acc_airpods;

    INSERT INTO accessory_variants (accessory_id, variant_name, description, attributes, mrp, selling_price, quantity, is_active) VALUES
      (v_acc_airpods, 'Silicone Protective AirPods Case - Matte Black', 'AirPods Case', '{"color": "Matte Black"}'::jsonb, 1199, 699, 30, TRUE),
      (v_acc_airpods, 'Silicone Protective AirPods Case - Midnight Blue', 'AirPods Case', '{"color": "Midnight Blue"}'::jsonb, 1199, 699, 20, TRUE),
      (v_acc_airpods, 'Silicone Protective AirPods Case - Dusty Pink', 'AirPods Case', '{"color": "Dusty Pink"}'::jsonb, 1199, 699, 15, TRUE);
  END IF;

  -- 6. Wallet Subcategory & Accessories
  SELECT id INTO v_sub_wallet FROM subcategories WHERE name ILIKE '%Wallet%' LIMIT 1;
  IF v_sub_wallet IS NOT NULL THEN
    INSERT INTO accessories (category_id, subcategory_id, brand_name, product_name, description, compatibility_type, is_active)
    VALUES (v_cat_id, v_sub_wallet, 'Wrapstore', 'MagSafe Leather Wallet', 'Premium vegan leather magnetic card holder wallet', 'apple', TRUE)
    RETURNING id INTO v_acc_wallet;

    INSERT INTO accessory_variants (accessory_id, variant_name, description, attributes, mrp, selling_price, quantity, is_active) VALUES
      (v_acc_wallet, 'MagSafe Leather Wallet - Saddle Brown', 'MagSafe Wallet', '{"color": "Saddle Brown"}'::jsonb, 1799, 999, 22, TRUE),
      (v_acc_wallet, 'MagSafe Leather Wallet - Black', 'MagSafe Wallet', '{"color": "Black"}'::jsonb, 1799, 999, 28, TRUE),
      (v_acc_wallet, 'MagSafe Leather Wallet - Forest Green', 'MagSafe Wallet', '{"color": "Forest Green"}'::jsonb, 1799, 999, 14, TRUE);
  END IF;

  -- 7. Watch Cases Subcategory & Accessories
  SELECT id INTO v_sub_watch_cases FROM subcategories WHERE name ILIKE '%Watch Cases%' LIMIT 1;
  IF v_sub_watch_cases IS NOT NULL THEN
    INSERT INTO accessories (category_id, subcategory_id, brand_name, product_name, description, compatibility_type, is_active)
    VALUES (v_cat_id, v_sub_watch_cases, 'Spigen', 'Rugged Armor Smartwatch Case', 'Shockproof TPU protective bumper case for smartwatch', 'universal', TRUE)
    RETURNING id INTO v_acc_watch_cases;

    INSERT INTO accessory_variants (accessory_id, variant_name, description, attributes, mrp, selling_price, quantity, is_active) VALUES
      (v_acc_watch_cases, 'Rugged Armor Smartwatch Case - Matte Black', 'Watch Case', '{"color": "Matte Black"}'::jsonb, 1299, 749, 20, TRUE),
      (v_acc_watch_cases, 'Rugged Armor Smartwatch Case - Titanium Grey', 'Watch Case', '{"color": "Titanium Grey"}'::jsonb, 1299, 749, 18, TRUE);
  END IF;

  -- 8. Phone Stand Subcategory & Accessories
  SELECT id INTO v_sub_phone_stand FROM subcategories WHERE name ILIKE '%Phone Stand%' LIMIT 1;
  IF v_sub_phone_stand IS NOT NULL THEN
    INSERT INTO accessories (category_id, subcategory_id, brand_name, product_name, description, compatibility_type, is_active)
    VALUES (v_cat_id, v_sub_phone_stand, 'Baseus', 'Aluminum Folding Desktop Phone Stand', 'Adjustable metal stand holder for phone & tablet', 'universal', TRUE)
    RETURNING id INTO v_acc_phone_stand;

    INSERT INTO accessory_variants (accessory_id, variant_name, description, attributes, mrp, selling_price, quantity, is_active) VALUES
      (v_acc_phone_stand, 'Aluminum Folding Phone Stand - Silver', 'Phone Stand', '{"color": "Silver"}'::jsonb, 1499, 849, 25, TRUE),
      (v_acc_phone_stand, 'Aluminum Folding Phone Stand - Space Grey', 'Phone Stand', '{"color": "Space Grey"}'::jsonb, 1499, 849, 30, TRUE);
  END IF;

  -- 9. Adapters Subcategory & Accessories
  SELECT id INTO v_sub_adapters FROM subcategories WHERE name ILIKE '%Adapter%' LIMIT 1;
  IF v_sub_adapters IS NOT NULL THEN
    INSERT INTO accessories (category_id, subcategory_id, brand_name, product_name, description, compatibility_type, is_active)
    VALUES (v_cat_id, v_sub_adapters, 'Anker', '20W USB-C Fast Charger Adapter', 'Compact PD Fast Wall Charger Adapter', 'universal', TRUE)
    RETURNING id INTO v_acc_adapters;

    INSERT INTO accessory_variants (accessory_id, variant_name, description, attributes, mrp, selling_price, quantity, is_active) VALUES
      (v_acc_adapters, '20W USB-C Fast Charger Adapter - White', 'Charger Adapter', '{"color": "White"}'::jsonb, 1599, 999, 40, TRUE),
      (v_acc_adapters, '20W USB-C Fast Charger Adapter - Black', 'Charger Adapter', '{"color": "Black"}'::jsonb, 1599, 999, 35, TRUE);
  END IF;

  -- 10. Lens Protector Subcategory & Accessories
  SELECT id INTO v_sub_lens FROM subcategories WHERE name ILIKE '%Lens%' LIMIT 1;
  IF v_sub_lens IS NOT NULL THEN
    INSERT INTO accessories (category_id, subcategory_id, brand_name, product_name, description, compatibility_type, is_active)
    VALUES (v_cat_id, v_sub_lens, 'Lito', 'Metallic Ring Camera Lens Protector', 'HD Tempered glass camera lens protection ring', 'apple', TRUE)
    RETURNING id INTO v_acc_lens;

    INSERT INTO accessory_variants (accessory_id, variant_name, description, attributes, mrp, selling_price, quantity, is_active) VALUES
      (v_acc_lens, 'Metallic Ring Camera Lens Protector - Black', 'Camera Lens Protector', '{"color": "Black"}'::jsonb, 799, 449, 50, TRUE),
      (v_acc_lens, 'Metallic Ring Camera Lens Protector - Silver', 'Camera Lens Protector', '{"color": "Silver"}'::jsonb, 799, 449, 45, TRUE),
      (v_acc_lens, 'Metallic Ring Camera Lens Protector - Gold', 'Camera Lens Protector', '{"color": "Gold"}'::jsonb, 799, 449, 30, TRUE);
  END IF;

END;
$$;
