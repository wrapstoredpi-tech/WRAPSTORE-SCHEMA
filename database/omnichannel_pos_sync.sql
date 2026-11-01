-- ============================================================
-- WRAPSTORE OMNICHANNEL POS SYNC MIGRATION
-- Staging Database: ppwpedkqlgjvdosxabtf.supabase.co
--
-- Safe to run in Supabase SQL Editor:
-- 1. Adds tracking & refund columns to online_orders
-- 2. Permits 'PACKED' status in online_orders_order_status_check
-- 3. Adds combo and color tracking to online_order_items
-- 4. Allows payments to link directly to online_orders without invoices
-- 5. Enables realtime publication on online_order_items
-- 6. Provides atomic idempotent order processing & cancellation RPCs
-- ============================================================

-- 1. Extend online_orders with tracking and refund columns
ALTER TABLE online_orders
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS courier_name TEXT,
  ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'NONE'
    CHECK (refund_status IN ('NONE', 'PENDING', 'PROCESSED', 'FAILED')),
  ADD COLUMN IF NOT EXISTS refund_id TEXT,
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10,2) DEFAULT 0;

-- Update status constraint to include 'PACKED'
ALTER TABLE online_orders
  DROP CONSTRAINT IF EXISTS online_orders_order_status_check;

ALTER TABLE online_orders
  ADD CONSTRAINT online_orders_order_status_check
  CHECK (order_status IN (
    'PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED',
    'READY_FOR_PICKUP', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'
  ));

-- 2. Extend online_order_items with selected color and combo support
ALTER TABLE online_order_items
  ADD COLUMN IF NOT EXISTS selected_color TEXT,
  ADD COLUMN IF NOT EXISTS is_combo BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS combo_id UUID REFERENCES combos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS combo_components JSONB;

-- 3. Extend payments to support online orders without invoices
ALTER TABLE payments
  ALTER COLUMN invoice_id DROP NOT NULL;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS online_order_id UUID REFERENCES online_orders(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PAID'
    CHECK (payment_status IN ('PAID', 'PENDING', 'FAILED', 'REFUNDED')),
  ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'NONE'
    CHECK (refund_status IN ('NONE', 'PENDING', 'PROCESSED', 'FAILED')),
  ADD COLUMN IF NOT EXISTS refund_id TEXT,
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_payments_online_order ON payments(online_order_id);

-- 4. Ensure realtime replication includes online_order_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'online_order_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE online_order_items;
  END IF;
END $$;

-- 5. Idempotent Customer & Stock Sync Function for Online Payments
CREATE OR REPLACE FUNCTION process_confirmed_online_order(
  p_order_id UUID,
  p_razorpay_payment_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_customer_id UUID;
  v_cust RECORD;
  v_component RECORD;
BEGIN
  -- Lock order row
  SELECT * INTO v_order FROM online_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Order not found');
  END IF;

  -- Idempotency check: if already confirmed and stock already deducted
  IF v_order.payment_status = 'PAID' AND v_order.order_status = 'CONFIRMED' THEN
    RETURN jsonb_build_object('success', TRUE, 'message', 'Order already processed');
  END IF;

  -- 1. Idempotently upsert customer by phone
  SELECT * INTO v_cust FROM customers WHERE phone = v_order.customer_phone LIMIT 1;
  IF FOUND THEN
    v_customer_id := v_cust.id;
    -- Only increment if not already accounted for
    UPDATE customers SET
      name = COALESCE(v_order.customer_name, name),
      email = COALESCE(v_order.customer_email, email),
      address = COALESCE(v_order.shipping_address, address),
      total_orders = total_orders + 1,
      total_spent = total_spent + v_order.grand_total,
      last_purchase_at = NOW(),
      updated_at = NOW()
    WHERE id = v_customer_id;
  ELSE
    INSERT INTO customers (
      name, phone, email, address, total_orders, total_spent, last_purchase_at
    ) VALUES (
      v_order.customer_name, v_order.customer_phone, v_order.customer_email,
      v_order.shipping_address, 1, v_order.grand_total, NOW()
    ) RETURNING id INTO v_customer_id;
  END IF;

  -- 2. Deduct stock for each line item (or combo components)
  FOR v_item IN (SELECT * FROM online_order_items WHERE order_id = p_order_id) LOOP
    IF v_item.is_combo AND v_item.combo_components IS NOT NULL THEN
      -- Deduct each combo component
      FOR v_component IN SELECT * FROM jsonb_to_recordset(v_item.combo_components) AS (product_id UUID, quantity INT) LOOP
        PERFORM deduct_stock(
          p_product_id   => v_component.product_id,
          p_quantity     => (v_component.quantity * v_item.quantity),
          p_channel      => 'ONLINE',
          p_reference_id => v_order.order_number
        );
      END LOOP;
    ELSIF v_item.product_id IS NOT NULL THEN
      PERFORM deduct_stock(
        p_product_id   => v_item.product_id,
        p_quantity     => v_item.quantity,
        p_channel      => 'ONLINE',
        p_reference_id => v_order.order_number
      );
    END IF;
  END LOOP;

  -- 3. Record payment linked to online order
  INSERT INTO payments (
    online_order_id, amount, payment_method, reference, payment_status
  ) VALUES (
    v_order.id, v_order.grand_total, v_order.payment_method, p_razorpay_payment_id, 'PAID'
  );

  -- 4. Update order record
  UPDATE online_orders SET
    customer_id = v_customer_id,
    payment_status = 'PAID',
    order_status = 'CONFIRMED',
    payment_reference = p_razorpay_payment_id,
    updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', TRUE, 'customer_id', v_customer_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION process_confirmed_online_order(UUID, TEXT) TO anon, authenticated;

-- 6. Cancel online order & release stock
CREATE OR REPLACE FUNCTION cancel_and_restock_online_order(
  p_order_id UUID,
  p_reason TEXT DEFAULT 'Cancelled by staff'
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_curr_stock INT;
  v_component RECORD;
BEGIN
  SELECT * INTO v_order FROM online_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Order not found');
  END IF;

  IF v_order.order_status = 'CANCELLED' THEN
    RETURN jsonb_build_object('success', TRUE, 'message', 'Order already cancelled');
  END IF;

  -- Restock items if order was confirmed / paid
  IF v_order.payment_status = 'PAID' OR v_order.order_status IN ('CONFIRMED', 'PROCESSING', 'PACKED') THEN
    FOR v_item IN (SELECT * FROM online_order_items WHERE order_id = p_order_id) LOOP
      IF v_item.is_combo AND v_item.combo_components IS NOT NULL THEN
        FOR v_component IN SELECT * FROM jsonb_to_recordset(v_item.combo_components) AS (product_id UUID, quantity INT) LOOP
          SELECT current_stock INTO v_curr_stock FROM products WHERE id = v_component.product_id FOR UPDATE;
          IF FOUND THEN
            UPDATE products SET current_stock = current_stock + (v_component.quantity * v_item.quantity), updated_at = NOW() WHERE id = v_component.product_id;
            INSERT INTO inventory_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, reason, reference_id, channel
            ) VALUES (
              v_component.product_id, 'CUSTOMER_RETURN', (v_component.quantity * v_item.quantity),
              v_curr_stock, v_curr_stock + (v_component.quantity * v_item.quantity),
              'Online order cancelled: ' || p_reason, v_order.order_number, 'website'
            );
          END IF;
        END LOOP;
      ELSIF v_item.product_id IS NOT NULL THEN
        SELECT current_stock INTO v_curr_stock FROM products WHERE id = v_item.product_id FOR UPDATE;
        IF FOUND THEN
          UPDATE products SET current_stock = current_stock + v_item.quantity, updated_at = NOW() WHERE id = v_item.product_id;
          INSERT INTO inventory_movements (
            product_id, movement_type, quantity, previous_stock, new_stock, reason, reference_id, channel
          ) VALUES (
            v_item.product_id, 'CUSTOMER_RETURN', v_item.quantity,
            v_curr_stock, v_curr_stock + v_item.quantity,
            'Online order cancelled: ' || p_reason, v_order.order_number, 'website'
          );
        END IF;
      END IF;
    END LOOP;
  ELSE
    -- If was pending, release reserved stock
    FOR v_item IN (SELECT * FROM online_order_items WHERE order_id = p_order_id) LOOP
      IF v_item.product_id IS NOT NULL THEN
        PERFORM release_reserved_stock(v_item.product_id, v_item.quantity, v_order.order_number);
      END IF;
    END LOOP;
  END IF;

  -- Record refund on payment if payment was made
  UPDATE payments SET
    refund_status = 'PROCESSED',
    refund_amount = amount
  WHERE online_order_id = p_order_id;

  -- Update order status
  UPDATE online_orders SET
    order_status = 'CANCELLED',
    cancelled_reason = p_reason,
    refund_status = CASE WHEN payment_status = 'PAID' THEN 'PROCESSED' ELSE 'NONE' END,
    updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', TRUE, 'status', 'CANCELLED');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION cancel_and_restock_online_order(UUID, TEXT) TO authenticated, anon;

