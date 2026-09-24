-- ============================================================
-- WRAPSTORE — ONLINE ORDER CONFIRMATION & CATALOG ACCESS MIGRATION
-- database/migration_online_order_confirmation.sql
--
-- Deploys:
--   1. confirm_cod_order(p_order_id UUID) -> JSONB
--   2. confirm_online_payment_order(p_order_id UUID) -> JSONB
--   3. cancel_online_order(p_order_id UUID, p_reason TEXT) -> JSONB
--   4. release_expired_reservations() -> VOID
--   5. Updated RLS policy on products (instant website visibility)
--   6. Public read RLS policies on categories, subcategories, product_images
--
-- Run this in Supabase SQL Editor.
-- Safe to re-run (uses DROP POLICY IF EXISTS / CREATE OR REPLACE).
-- ============================================================

-- ============================================================
-- 1a. CONFIRM COD ORDER
-- Deducts stock atomically for COD orders in PENDING status.
-- ============================================================
CREATE OR REPLACE FUNCTION confirm_cod_order(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_order         RECORD;
  v_item          RECORD;
  v_current_stock INT;
  v_reserved      INT;
  v_deduct_res    JSONB;
BEGIN
  -- 1. Fetch & lock order row
  SELECT * INTO v_order
  FROM online_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Order not found');
  END IF;

  -- 2. Verify payment_method = 'COD'
  IF UPPER(v_order.payment_method) != 'COD' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Order payment method is not COD (found: ' || v_order.payment_method || ')'
    );
  END IF;

  -- 3. Verify order_status = 'PENDING'
  IF UPPER(v_order.order_status) != 'PENDING' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Order is not in PENDING status (current status: ' || v_order.order_status || ')'
    );
  END IF;

  -- 4. Pre-check stock for all line items with row locks
  -- Prevents partial deductions if any item is short on stock
  FOR v_item IN (SELECT * FROM online_order_items WHERE order_id = p_order_id) LOOP
    SELECT current_stock, reserved_stock
    INTO v_current_stock, v_reserved
    FROM products
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Product not found for item: ' || COALESCE(v_item.product_name, v_item.product_id::text)
      );
    END IF;

    IF v_current_stock < v_item.quantity THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Insufficient stock for product: ' || v_item.product_name,
        'product_id', v_item.product_id,
        'available', v_current_stock,
        'requested', v_item.quantity
      );
    END IF;
  END LOOP;

  -- 5. Deduct stock for each line item
  FOR v_item IN (SELECT * FROM online_order_items WHERE order_id = p_order_id) LOOP
    v_deduct_res := deduct_stock(
      p_product_id   => v_item.product_id,
      p_quantity     => v_item.quantity,
      p_channel      => 'ONLINE',
      p_reference_id => v_order.order_number
    );

    IF (v_deduct_res->>'success')::boolean IS NOT TRUE THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', COALESCE(v_deduct_res->>'error', 'Failed to deduct stock for ' || v_item.product_name),
        'details', v_deduct_res
      );
    END IF;
  END LOOP;

  -- 6. Update order status to CONFIRMED
  UPDATE online_orders
  SET order_status = 'CONFIRMED',
      updated_at   = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'order_id', v_order.id,
    'order_number', v_order.order_number
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION confirm_cod_order(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION confirm_cod_order(UUID) TO authenticated;


-- ============================================================
-- 1b. CONFIRM ONLINE PAYMENT ORDER
-- Deducts stock atomically for prepaid orders verified as PAID.
-- ============================================================
CREATE OR REPLACE FUNCTION confirm_online_payment_order(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_order         RECORD;
  v_item          RECORD;
  v_current_stock INT;
  v_reserved      INT;
  v_deduct_res    JSONB;
BEGIN
  -- 1. Fetch & lock order row
  SELECT * INTO v_order
  FROM online_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Order not found');
  END IF;

  -- 2. Verify payment_status = 'PAID'
  IF UPPER(v_order.payment_status) != 'PAID' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Order payment status is not PAID (current status: ' || v_order.payment_status || ')'
    );
  END IF;

  -- 3. Verify order_status = 'PENDING'
  IF UPPER(v_order.order_status) != 'PENDING' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Order is not in PENDING status (current status: ' || v_order.order_status || ')'
    );
  END IF;

  -- 4. Pre-check stock for all line items with row locks
  FOR v_item IN (SELECT * FROM online_order_items WHERE order_id = p_order_id) LOOP
    SELECT current_stock, reserved_stock
    INTO v_current_stock, v_reserved
    FROM products
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Product not found for item: ' || COALESCE(v_item.product_name, v_item.product_id::text)
      );
    END IF;

    IF v_current_stock < v_item.quantity THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Insufficient stock for product: ' || v_item.product_name,
        'product_id', v_item.product_id,
        'available', v_current_stock,
        'requested', v_item.quantity
      );
    END IF;
  END LOOP;

  -- 5. Deduct stock for each line item
  FOR v_item IN (SELECT * FROM online_order_items WHERE order_id = p_order_id) LOOP
    v_deduct_res := deduct_stock(
      p_product_id   => v_item.product_id,
      p_quantity     => v_item.quantity,
      p_channel      => 'ONLINE',
      p_reference_id => v_order.order_number
    );

    IF (v_deduct_res->>'success')::boolean IS NOT TRUE THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', COALESCE(v_deduct_res->>'error', 'Failed to deduct stock for ' || v_item.product_name),
        'details', v_deduct_res
      );
    END IF;
  END LOOP;

  -- 6. Update order status to CONFIRMED
  UPDATE online_orders
  SET order_status = 'CONFIRMED',
      updated_at   = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'order_id', v_order.id,
    'order_number', v_order.order_number
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION confirm_online_payment_order(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION confirm_online_payment_order(UUID) TO authenticated;


-- ============================================================
-- 1c. CANCEL ONLINE ORDER
-- Releases reserved stock and marks order cancelled.
-- ============================================================
CREATE OR REPLACE FUNCTION cancel_online_order(
  p_order_id UUID,
  p_reason   TEXT DEFAULT 'Cancelled by admin'
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_item  RECORD;
BEGIN
  -- 1. Fetch & lock order row
  SELECT * INTO v_order
  FROM online_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Order not found');
  END IF;

  -- 2. Verify order_status = 'PENDING'
  IF UPPER(v_order.order_status) != 'PENDING' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Only PENDING orders can be cancelled (current status: ' || v_order.order_status || ')'
    );
  END IF;

  -- 3. Release reserved stock for every item
  FOR v_item IN (SELECT * FROM online_order_items WHERE order_id = p_order_id) LOOP
    IF v_item.product_id IS NOT NULL THEN
      PERFORM release_reserved_stock(
        p_product_id   => v_item.product_id,
        p_quantity     => v_item.quantity,
        p_reference_id => v_order.order_number
      );
    END IF;
  END LOOP;

  -- 4. Update order status
  UPDATE online_orders SET
    order_status     = 'CANCELLED',
    payment_status   = 'FAILED',
    cancelled_reason = p_reason,
    updated_at       = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'status', 'CANCELLED'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION cancel_online_order(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cancel_online_order(UUID, TEXT) TO authenticated;


-- ============================================================
-- 1d. RELEASE EXPIRED RESERVATIONS
-- Automatically cancels PENDING orders older than 30 minutes
-- and returns reserved stock to available inventory.
-- ============================================================
CREATE OR REPLACE FUNCTION release_expired_reservations()
RETURNS VOID AS $$
DECLARE
  v_order RECORD;
  v_item  RECORD;
BEGIN
  FOR v_order IN
    SELECT id, order_number
    FROM online_orders
    WHERE order_status = 'PENDING'
      AND created_at < (NOW() - INTERVAL '30 minutes')
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Release reserved stock for each item
    FOR v_item IN
      SELECT product_id, quantity
      FROM online_order_items
      WHERE order_id = v_order.id
    LOOP
      IF v_item.product_id IS NOT NULL THEN
        PERFORM release_reserved_stock(
          p_product_id   => v_item.product_id,
          p_quantity     => v_item.quantity,
          p_reference_id => v_order.order_number
        );
      END IF;
    END LOOP;

    -- Update order to CANCELLED / FAILED
    UPDATE online_orders SET
      order_status     = 'CANCELLED',
      payment_status   = 'FAILED',
      cancelled_reason = 'Reservation expired',
      updated_at       = NOW()
    WHERE id = v_order.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION release_expired_reservations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION release_expired_reservations() TO authenticated;

-- ------------------------------------------------------------
-- CRON SCHEDULING NOTE:
-- To schedule release_expired_reservations() to run automatically every 10 minutes:
-- 1. Enable pg_cron extension in Supabase Dashboard -> Database -> Extensions -> pg_cron
-- 2. Run the following command in the SQL Editor:
--
--    SELECT cron.schedule(
--      'release-expired-order-reservations',
--      '*/10 * * * *',
--      'SELECT release_expired_reservations();'
--    );
-- ------------------------------------------------------------


-- ============================================================
-- 2. PRODUCTS RLS POLICY UPDATE
-- Remove approval_status = 'APPROVED' requirement for website visibility.
-- Any active product with online_visible = TRUE is immediately visible.
-- (Internal POS approval workflow in ProductApproval.jsx is untouched).
-- ============================================================

DROP POLICY IF EXISTS "Public can read online products" ON products;
CREATE POLICY "Public can read online products" ON products
  FOR SELECT TO anon
  USING (online_visible = TRUE AND is_active = TRUE);


-- ============================================================
-- 3. PUBLIC CATALOG READ ACCESS POLICIES
-- Enables anonymous website visitors to filter products by category/subcategory
-- and view product gallery images.
-- ============================================================

-- 3a. CATEGORIES
DROP POLICY IF EXISTS "Public can read active categories" ON categories;
CREATE POLICY "Public can read active categories" ON categories
  FOR SELECT TO anon
  USING (is_active = TRUE);

-- 3b. SUBCATEGORIES
DROP POLICY IF EXISTS "Public can read active subcategories" ON subcategories;
CREATE POLICY "Public can read active subcategories" ON subcategories
  FOR SELECT TO anon
  USING (is_active = TRUE);

-- 3c. PRODUCT IMAGES
-- Images have no sensitive data and link to products via product_id.
-- Note: The website frontend queries images for products it already fetched
-- via the public products policy above.
DROP POLICY IF EXISTS "Public can read product images" ON product_images;
CREATE POLICY "Public can read product images" ON product_images
  FOR SELECT TO anon
  USING (TRUE);
