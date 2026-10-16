-- ============================================================
-- WRAPSTORE - AUTOMATIC COMBO ALLOTTED_QTY SYNC TRIGGER
-- Recalculates combo_items.allotted_qty & combos.items
-- whenever products.current_stock changes (e.g. sales, adjustments).
--
-- Run in Supabase Dashboard -> SQL Editor:
-- https://supabase.com/dashboard/project/ppwpedkqlgjvdosxabtf/sql/new
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_combos_on_stock_change()
RETURNS TRIGGER AS $$
DECLARE
  v_combo_record RECORD;
  v_min_stock INT;
  v_updated_items JSONB;
BEGIN
  -- Only execute if current_stock changed
  IF (TG_OP = 'UPDATE' AND OLD.current_stock IS NOT DISTINCT FROM NEW.current_stock) THEN
    RETURN NEW;
  END IF;

  -- Loop through all active combos containing the updated product
  FOR v_combo_record IN
    SELECT DISTINCT c.id, c.items
    FROM public.combos c
    JOIN public.combo_items ci ON ci.combo_id = c.id
    WHERE ci.product_id = NEW.id
      AND c.is_active = TRUE
  LOOP
    -- Calculate minimum stock among all products in this combo
    SELECT COALESCE(MIN(GREATEST(0, p.current_stock)), 0)
    INTO v_min_stock
    FROM public.combo_items ci
    JOIN public.products p ON p.id = ci.product_id
    WHERE ci.combo_id = v_combo_record.id;

    -- Update combo_items table
    UPDATE public.combo_items
    SET allotted_qty = v_min_stock
    WHERE combo_id = v_combo_record.id;

    -- Update JSON items snapshot in combos table
    IF v_combo_record.items IS NOT NULL AND jsonb_typeof(v_combo_record.items) = 'array' THEN
      SELECT jsonb_agg(
        jsonb_set(item, '{allotted_qty}', to_jsonb(v_min_stock))
      )
      INTO v_updated_items
      FROM jsonb_array_elements(v_combo_record.items) AS item;

      UPDATE public.combos
      SET items = COALESCE(v_updated_items, items),
          updated_at = NOW()
      WHERE id = v_combo_record.id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_combos_on_stock_change ON public.products;
CREATE TRIGGER trigger_sync_combos_on_stock_change
AFTER UPDATE OF current_stock ON public.products
FOR EACH ROW EXECUTE FUNCTION public.sync_combos_on_stock_change();

-- Run an initial sync on all existing combos based on current product stock
DO $$
DECLARE
  v_c RECORD;
  v_min INT;
  v_upd JSONB;
BEGIN
  FOR v_c IN SELECT id, items FROM public.combos WHERE is_active = TRUE LOOP
    SELECT COALESCE(MIN(GREATEST(0, p.current_stock)), 0)
    INTO v_min
    FROM public.combo_items ci
    JOIN public.products p ON p.id = ci.product_id
    WHERE ci.combo_id = v_c.id;

    IF v_min IS NOT NULL THEN
      UPDATE public.combo_items
      SET allotted_qty = v_min
      WHERE combo_id = v_c.id;

      IF v_c.items IS NOT NULL AND jsonb_typeof(v_c.items) = 'array' THEN
        SELECT jsonb_agg(
          jsonb_set(item, '{allotted_qty}', to_jsonb(v_min))
        )
        INTO v_upd
        FROM jsonb_array_elements(v_c.items) AS item;

        UPDATE public.combos
        SET items = COALESCE(v_upd, items),
            updated_at = NOW()
        WHERE id = v_c.id;
      END IF;
    END IF;
  END LOOP;
END $$;
