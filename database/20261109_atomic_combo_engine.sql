-- ==============================================================================
-- WRAPSTORE ATOMIC COMBO ENGINE MIGRATION
-- Staging Database: ppwpedkqlgjvdosxabtf.supabase.co
-- Date: 2026-11-09
-- 
-- Summary:
-- 1. Adds combo_items.qty_per_combo (default 1) and backfills from JSON.
-- 2. Adds combos.image_url and combos.images with backfill.
-- 3. Adds non-negative stock constraints on products (current_stock >= 0, reserved_stock >= 0).
-- 4. Creates trigger to bump combos.updated_at on combo or item modification.
-- 5. Creates view `combos_with_availability` computing dynamic stock & limiting item.
-- 6. Creates atomic, deadlock-safe RPC functions:
--      - sell_combo (locks in ID order, checks availability, deducts, logs movement)
--      - return_combo (exact-once idempotent reversal from order's historical deduction)
--      - reserve_combo_stock & release_combo_stock
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SCHEMA EXTENSIONS: combo_items & combos
-- ------------------------------------------------------------------------------

-- Add qty_per_combo to combo_items
ALTER TABLE public.combo_items
  ADD COLUMN IF NOT EXISTS qty_per_combo INT NOT NULL DEFAULT 1 CHECK (qty_per_combo >= 1);

-- Backfill qty_per_combo from combos.items JSON where unit_quantity / quantity is recorded
UPDATE public.combo_items ci
SET qty_per_combo = GREATEST(1, COALESCE((
  SELECT NULLIF((item_elem->>'unit_quantity')::int, 0)
  FROM public.combos c,
       jsonb_array_elements(CASE WHEN jsonb_typeof(c.items) = 'array' THEN c.items ELSE '[]'::jsonb END) AS item_elem
  WHERE c.id = ci.combo_id
    AND (item_elem->>'product_id')::text = ci.product_id::text
  LIMIT 1
), 1))
WHERE qty_per_combo = 1;

-- Add image_url and images to combos
ALTER TABLE public.combos
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- Backfill combos.image_url from items snapshot if available
UPDATE public.combos
SET image_url = COALESCE(
  image_url,
  items->0->>'combo_image',
  items->0->'combo_images'->>0
)
WHERE image_url IS NULL
  AND jsonb_typeof(items) = 'array'
  AND jsonb_array_length(items) > 0;

-- ------------------------------------------------------------------------------
-- 2. STOCK NON-NEGATIVE CONSTRAINTS
-- ------------------------------------------------------------------------------
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_current_stock_non_negative;

ALTER TABLE public.products
  ADD CONSTRAINT products_current_stock_non_negative
  CHECK (current_stock >= 0);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_reserved_stock_non_negative;

ALTER TABLE public.products
  ADD CONSTRAINT products_reserved_stock_non_negative
  CHECK (reserved_stock >= 0);

-- Allow both 'offline' and 'pos' on inventory_movements.channel
ALTER TABLE public.inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_channel_check;

ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_channel_check
  CHECK (channel IN ('offline','pos','website','amazon','flipkart','instagram','whatsapp','other'));

-- ------------------------------------------------------------------------------
-- 3. TRIGGERS: Bump combos.updated_at
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_bump_combo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'combos' THEN
    NEW.updated_at = NOW();
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'combo_items' THEN
    UPDATE public.combos
    SET updated_at = NOW()
    WHERE id = COALESCE(NEW.combo_id, OLD.combo_id);
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_combos_bump_updated_at ON public.combos;
CREATE TRIGGER trg_combos_bump_updated_at
  BEFORE UPDATE ON public.combos
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_bump_combo_updated_at();

DROP TRIGGER IF EXISTS trg_combo_items_bump_updated_at ON public.combo_items;
CREATE TRIGGER trg_combo_items_bump_updated_at
  AFTER INSERT OR UPDATE OR DELETE ON public.combo_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_bump_combo_updated_at();

-- ------------------------------------------------------------------------------
-- 4. VIEW: combos_with_availability
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.combos_with_availability AS
WITH item_avail AS (
  SELECT
    c.id AS combo_id,
    ci.id AS combo_item_id,
    ci.product_id,
    COALESCE(p.name, ci.product_name, 'Unknown Product') AS product_name,
    GREATEST(1, COALESCE(ci.qty_per_combo, 1)) AS qty_per_combo,
    COALESCE(p.current_stock, 0) AS current_stock,
    COALESCE(p.reserved_stock, 0) AS reserved_stock,
    GREATEST(0, COALESCE(p.current_stock, 0) - COALESCE(p.reserved_stock, 0)) AS available_stock,
    CASE
      WHEN p.id IS NULL OR p.is_active = FALSE OR p.approval_status != 'APPROVED' THEN 0
      ELSE FLOOR(GREATEST(0, COALESCE(p.current_stock, 0) - COALESCE(p.reserved_stock, 0))::numeric / GREATEST(1, COALESCE(ci.qty_per_combo, 1)))::int
    END AS possible_from_item,
    ROW_NUMBER() OVER (
      PARTITION BY c.id
      ORDER BY
        CASE
          WHEN p.id IS NULL OR p.is_active = FALSE OR p.approval_status != 'APPROVED' THEN 0
          ELSE FLOOR(GREATEST(0, COALESCE(p.current_stock, 0) - COALESCE(p.reserved_stock, 0))::numeric / GREATEST(1, COALESCE(ci.qty_per_combo, 1)))::int
        END ASC,
        GREATEST(0, COALESCE(p.current_stock, 0) - COALESCE(p.reserved_stock, 0)) ASC,
        ci.id ASC
    ) AS rank_limiting
  FROM public.combos c
  JOIN public.combo_items ci ON ci.combo_id = c.id
  LEFT JOIN public.products p ON p.id = ci.product_id
),
combo_summary AS (
  SELECT
    combo_id,
    COUNT(*) AS total_items,
    MIN(possible_from_item) AS available_combos,
    MAX(CASE WHEN rank_limiting = 1 THEN product_id::text END)::uuid AS limiting_product_id,
    MAX(CASE WHEN rank_limiting = 1 THEN product_name END) AS limiting_product_name,
    MAX(CASE WHEN rank_limiting = 1 THEN available_stock END) AS limiting_product_stock,
    MAX(CASE WHEN rank_limiting = 1 THEN qty_per_combo END) AS limiting_qty_per_combo
  FROM item_avail
  GROUP BY combo_id
)
SELECT
  c.id,
  c.combo_code,
  c.code,
  c.name,
  c.description,
  c.selling_price,
  c.original_value,
  c.image_url,
  c.images,
  c.items,
  c.is_active,
  c.created_by,
  c.created_at,
  c.updated_at,
  COALESCE(cs.available_combos, 0)::int AS available_combos,
  cs.limiting_product_id,
  cs.limiting_product_name,
  cs.limiting_product_stock,
  cs.limiting_qty_per_combo,
  CASE
    WHEN c.is_active = FALSE THEN 'out'
    WHEN COALESCE(cs.total_items, 0) = 0 THEN 'out'
    WHEN COALESCE(cs.available_combos, 0) <= 0 THEN 'out'
    WHEN cs.available_combos <= 3 THEN 'low'
    ELSE 'in_stock'
  END AS status
FROM public.combos c
LEFT JOIN combo_summary cs ON cs.combo_id = c.id;

GRANT SELECT ON public.combos_with_availability TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. FUNCTION: sell_combo (Atomic POS / Website Sale)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sell_combo(
  p_combo_id UUID,
  p_qty INT,
  p_channel TEXT DEFAULT 'POS',
  p_reference TEXT DEFAULT NULL,
  p_performed_by UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_combo RECORD;
  v_item RECORD;
  v_product RECORD;
  v_req_qty INT;
  v_movement_type TEXT;
  v_channel_norm TEXT;
  v_deducted_items JSONB := '[]'::jsonb;
BEGIN
  -- 1. Validation
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Quantity must be at least 1');
  END IF;

  SELECT * INTO v_combo FROM public.combos WHERE id = p_combo_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Combo not found');
  END IF;

  IF v_combo.is_active = FALSE THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Combo is currently inactive');
  END IF;

  v_channel_norm := CASE
    WHEN LOWER(COALESCE(p_channel, 'offline')) IN ('pos', 'offline') THEN 'offline'
    WHEN LOWER(p_channel) IN ('online', 'web', 'website') THEN 'website'
    WHEN LOWER(p_channel) IN ('amazon', 'flipkart', 'instagram', 'whatsapp', 'other') THEN LOWER(p_channel)
    ELSE 'offline'
  END;
  v_movement_type := CASE WHEN v_channel_norm = 'offline' THEN 'SALE' ELSE 'ONLINE_SALE' END;

  -- Verify combo has constituent items
  IF NOT EXISTS (SELECT 1 FROM public.combo_items WHERE combo_id = p_combo_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Combo has no constituent products');
  END IF;

  -- 2. Lock product rows in deterministic ID order to prevent deadlocks
  -- Check availability and validity under lock
  FOR v_item IN
    SELECT
      ci.id AS combo_item_id,
      ci.product_id,
      GREATEST(1, COALESCE(ci.qty_per_combo, 1)) AS qty_per_combo,
      COALESCE(ci.product_name, 'Component Item') AS fallback_name
    FROM public.combo_items ci
    WHERE ci.combo_id = p_combo_id
    ORDER BY ci.product_id ASC
  LOOP
    IF v_item.product_id IS NULL THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Combo contains an invalid product item (missing product ID)');
    END IF;

    -- Lock product row
    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Product not found: ' || v_item.fallback_name);
    END IF;

    IF v_product.is_active = FALSE OR v_product.approval_status != 'APPROVED' THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Product "' || v_product.name || '" is inactive or unapproved');
    END IF;

    v_req_qty := v_item.qty_per_combo * p_qty;

    -- Availability check:
    -- If POS: available = current_stock - reserved_stock
    -- If Online: if stock was already reserved during checkout, available = current_stock
    IF v_channel_norm = 'offline' THEN
      IF (COALESCE(v_product.current_stock, 0) - COALESCE(v_product.reserved_stock, 0)) < v_req_qty THEN
        RETURN jsonb_build_object(
          'success', FALSE,
          'error', 'Insufficient stock for "' || v_product.name || '": requested ' || v_req_qty || ' units, but only ' ||
                   GREATEST(0, COALESCE(v_product.current_stock, 0) - COALESCE(v_product.reserved_stock, 0)) || ' available (' ||
                   v_product.current_stock || ' in hand, ' || v_product.reserved_stock || ' reserved)'
        );
      END IF;
    ELSE
      IF COALESCE(v_product.current_stock, 0) < v_req_qty THEN
        RETURN jsonb_build_object(
          'success', FALSE,
          'error', 'Insufficient stock for "' || v_product.name || '": requested ' || v_req_qty || ' units, current stock is ' || v_product.current_stock
        );
      END IF;
    END IF;
  END LOOP;

  -- 3. All items verified! Perform atomic deduction and movement logging
  FOR v_item IN
    SELECT
      ci.product_id,
      GREATEST(1, COALESCE(ci.qty_per_combo, 1)) AS qty_per_combo
    FROM public.combo_items ci
    WHERE ci.combo_id = p_combo_id
    ORDER BY ci.product_id ASC
  LOOP
    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE;

    v_req_qty := v_item.qty_per_combo * p_qty;

    UPDATE public.products
    SET current_stock = current_stock - v_req_qty,
        -- If online sale with previous reservation, clear the reservation
        reserved_stock = CASE
          WHEN v_channel_norm != 'offline' THEN GREATEST(0, reserved_stock - v_req_qty)
          ELSE reserved_stock
        END,
        updated_at = NOW()
    WHERE id = v_item.product_id;

    INSERT INTO public.inventory_movements (
      product_id,
      movement_type,
      quantity,
      previous_stock,
      new_stock,
      reason,
      reference_id,
      channel,
      performed_by
    ) VALUES (
      v_item.product_id,
      v_movement_type,
      v_req_qty,
      v_product.current_stock,
      v_product.current_stock - v_req_qty,
      'Combo ' || COALESCE(v_combo.combo_code, v_combo.code, 'BUNDLE') || ' x ' || p_qty,
      p_reference,
      v_channel_norm,
      p_performed_by
    );

    v_deducted_items := v_deducted_items || jsonb_build_object(
      'product_id', v_item.product_id,
      'product_name', v_product.name,
      'deducted_quantity', v_req_qty,
      'remaining_stock', v_product.current_stock - v_req_qty
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'combo_id', p_combo_id,
    'combo_code', v_combo.combo_code,
    'quantity', p_qty,
    'items', v_deducted_items
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.sell_combo(UUID, INT, TEXT, TEXT, UUID) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. FUNCTION: return_combo (Exact Reversal of Recorded Deductions)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.return_combo(
  p_reference TEXT,
  p_performed_by UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_mov RECORD;
  v_product RECORD;
  v_reversal_type TEXT;
  v_restored_items JSONB := '[]'::jsonb;
BEGIN
  IF p_reference IS NULL OR TRIM(p_reference) = '' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Order/invoice reference is required');
  END IF;

  -- 1. Idempotency Check: if this reference was already returned/reversed
  IF EXISTS (
    SELECT 1 FROM public.inventory_movements
    WHERE reference_id = p_reference
      AND movement_type IN ('CUSTOMER_RETURN', 'ONLINE_RETURN')
  ) THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'Order reference ' || p_reference || ' has already been returned/restocked',
      'already_processed', TRUE
    );
  END IF;

  -- 2. Find original sale deductions recorded for this reference
  IF NOT EXISTS (
    SELECT 1 FROM public.inventory_movements
    WHERE reference_id = p_reference
      AND movement_type IN ('SALE', 'ONLINE_SALE')
  ) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'No stock deductions found under reference: ' || p_reference
    );
  END IF;

  -- 3. Lock products and restore exact quantities deducted
  FOR v_mov IN
    SELECT
      im.product_id,
      im.movement_type,
      im.quantity,
      im.reason,
      im.channel
    FROM public.inventory_movements im
    WHERE im.reference_id = p_reference
      AND im.movement_type IN ('SALE', 'ONLINE_SALE')
    ORDER BY im.product_id ASC
  LOOP
    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_mov.product_id
    FOR UPDATE;

    IF FOUND THEN
      v_reversal_type := CASE WHEN v_mov.movement_type = 'ONLINE_SALE' THEN 'ONLINE_RETURN' ELSE 'CUSTOMER_RETURN' END;

      UPDATE public.products
      SET current_stock = current_stock + v_mov.quantity,
          updated_at = NOW()
      WHERE id = v_mov.product_id;

      INSERT INTO public.inventory_movements (
        product_id,
        movement_type,
        quantity,
        previous_stock,
        new_stock,
        reason,
        reference_id,
        channel,
        performed_by
      ) VALUES (
        v_mov.product_id,
        v_reversal_type,
        v_mov.quantity,
        v_product.current_stock,
        v_product.current_stock + v_mov.quantity,
        'Return: ' || COALESCE(v_mov.reason, 'Combo reversal'),
        p_reference,
        v_mov.channel,
        p_performed_by
      );

      v_restored_items := v_restored_items || jsonb_build_object(
        'product_id', v_mov.product_id,
        'product_name', v_product.name,
        'restored_quantity', v_mov.quantity,
        'new_stock', v_product.current_stock + v_mov.quantity
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'reference', p_reference,
    'restored_items', v_restored_items
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.return_combo(TEXT, UUID) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. FUNCTIONS: reserve_combo_stock & release_combo_stock (Online Checkout)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_combo_stock(
  p_combo_id UUID,
  p_qty INT,
  p_reference TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_item RECORD;
  v_product RECORD;
  v_req_qty INT;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Quantity must be positive');
  END IF;

  -- 1. Lock items in ID order and verify availability
  FOR v_item IN
    SELECT
      ci.product_id,
      GREATEST(1, COALESCE(ci.qty_per_combo, 1)) AS qty_per_combo,
      COALESCE(ci.product_name, 'Component') AS product_name
    FROM public.combo_items ci
    WHERE ci.combo_id = p_combo_id
    ORDER BY ci.product_id ASC
  LOOP
    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Product not found: ' || v_item.product_name);
    END IF;

    v_req_qty := v_item.qty_per_combo * p_qty;

    IF (COALESCE(v_product.current_stock, 0) - COALESCE(v_product.reserved_stock, 0)) < v_req_qty THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Cannot reserve stock for "' || v_product.name || '": only ' ||
                 GREATEST(0, COALESCE(v_product.current_stock, 0) - COALESCE(v_product.reserved_stock, 0)) || ' available'
      );
    END IF;
  END LOOP;

  -- 2. Increment reserved_stock atomically
  FOR v_item IN
    SELECT
      ci.product_id,
      GREATEST(1, COALESCE(ci.qty_per_combo, 1)) AS qty_per_combo
    FROM public.combo_items ci
    WHERE ci.combo_id = p_combo_id
    ORDER BY ci.product_id ASC
  LOOP
    v_req_qty := v_item.qty_per_combo * p_qty;
    UPDATE public.products
    SET reserved_stock = reserved_stock + v_req_qty,
        updated_at = NOW()
    WHERE id = v_item.product_id;
  END LOOP;

  RETURN jsonb_build_object('success', TRUE, 'combo_id', p_combo_id, 'reserved_combos', p_qty);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.reserve_combo_stock(UUID, INT, TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.release_combo_stock(
  p_combo_id UUID,
  p_qty INT,
  p_reference TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_item RECORD;
  v_req_qty INT;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Quantity must be positive');
  END IF;

  FOR v_item IN
    SELECT
      ci.product_id,
      GREATEST(1, COALESCE(ci.qty_per_combo, 1)) AS qty_per_combo
    FROM public.combo_items ci
    WHERE ci.combo_id = p_combo_id
    ORDER BY ci.product_id ASC
  LOOP
    v_req_qty := v_item.qty_per_combo * p_qty;
    UPDATE public.products
    SET reserved_stock = GREATEST(0, reserved_stock - v_req_qty),
        updated_at = NOW()
    WHERE id = v_item.product_id;
  END LOOP;

  RETURN jsonb_build_object('success', TRUE, 'combo_id', p_combo_id, 'released_combos', p_qty);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.release_combo_stock(UUID, INT, TEXT) TO anon, authenticated, service_role;
