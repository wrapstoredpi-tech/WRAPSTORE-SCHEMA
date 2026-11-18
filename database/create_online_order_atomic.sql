-- ============================================================
-- WRAPSTORE — ATOMIC ONLINE ORDER CREATION & ITEM PERSISTENCE
-- database/create_online_order_atomic.sql
-- ============================================================

CREATE OR REPLACE FUNCTION create_online_order_atomic(
  p_order JSONB,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created_order RECORD;
  v_order_id      UUID;
  v_order_number  TEXT;
  v_item          JSONB;
  v_prod_uuid     UUID;
  v_prod_code     TEXT;
  v_qty           INT;
  v_unit_price    NUMERIC(10,2);
  v_line_total    NUMERIC(10,2);
  v_inserted_items JSONB := '[]'::jsonb;
  v_item_record   RECORD;
  v_deduct_res    JSONB;
BEGIN
  -- 1. Validate items payload
  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cannot place order: Cart items list cannot be empty';
  END IF;

  -- 2. Insert order header into online_orders
  INSERT INTO online_orders (
    customer_name,
    customer_phone,
    customer_email,
    shipping_address,
    billing_address,
    subtotal,
    discount_amount,
    gst_amount,
    shipping_amount,
    grand_total,
    payment_method,
    payment_status,
    order_status,
    payment_reference,
    source,
    notes
  ) VALUES (
    COALESCE(NULLIF(p_order->>'customer_name', ''), 'Customer'),
    COALESCE(NULLIF(p_order->>'customer_phone', ''), ''),
    NULLIF(p_order->>'customer_email', ''),
    COALESCE(NULLIF(p_order->>'shipping_address', ''), ''),
    COALESCE(NULLIF(p_order->>'billing_address', ''), NULLIF(p_order->>'shipping_address', ''), ''),
    COALESCE((p_order->>'subtotal')::NUMERIC, 0),
    COALESCE((p_order->>'discount_amount')::NUMERIC, 0),
    COALESCE((p_order->>'gst_amount')::NUMERIC, 0),
    COALESCE((p_order->>'shipping_amount')::NUMERIC, 0),
    COALESCE((p_order->>'grand_total')::NUMERIC, 0),
    COALESCE(NULLIF(p_order->>'payment_method', ''), 'Online'),
    COALESCE(NULLIF(p_order->>'payment_status', ''), 'PAID'),
    COALESCE(NULLIF(p_order->>'order_status', ''), 'CONFIRMED'),
    NULLIF(p_order->>'payment_reference', ''),
    COALESCE(NULLIF(p_order->>'source', ''), 'WEBSITE'),
    NULLIF(p_order->>'notes', '')
  )
  RETURNING * INTO v_created_order;

  v_order_id     := v_created_order.id;
  v_order_number := v_created_order.order_number;

  -- 3. Insert each purchased cart item into online_order_items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_prod_uuid := NULL;
    v_prod_code := NULLIF(v_item->>'product_id_code', '');

    -- Check if product_id is a valid UUID and exists in products table
    IF (v_item->>'product_id') IS NOT NULL AND (v_item->>'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      SELECT id, product_id INTO v_prod_uuid, v_prod_code
      FROM products
      WHERE id = (v_item->>'product_id')::UUID;
    END IF;

    -- If product_id_code not retrieved from products table, use provided code
    IF v_prod_code IS NULL THEN
      v_prod_code := NULLIF(v_item->>'product_id_code', '');
    END IF;

    v_qty        := GREATEST(1, COALESCE((v_item->>'quantity')::INT, 1));
    v_unit_price := COALESCE((v_item->>'unit_price')::NUMERIC, 0);
    v_line_total := COALESCE((v_item->>'line_total')::NUMERIC, v_qty * v_unit_price);

    INSERT INTO online_order_items (
      order_id,
      product_id,
      product_id_code,
      product_name,
      product_type,
      mobile_brand,
      mobile_model,
      quantity,
      unit_price,
      discount_pct,
      gst_pct,
      line_total
    ) VALUES (
      v_order_id,
      v_prod_uuid,
      v_prod_code,
      COALESCE(NULLIF(v_item->>'product_name', ''), 'Product'),
      NULLIF(v_item->>'product_type', ''),
      NULLIF(v_item->>'mobile_brand', ''),
      NULLIF(v_item->>'mobile_model', ''),
      v_qty,
      v_unit_price,
      COALESCE((v_item->>'discount_pct')::NUMERIC, 0),
      COALESCE((v_item->>'gst_pct')::NUMERIC, 18),
      v_line_total
    )
    RETURNING * INTO v_item_record;

    v_inserted_items := v_inserted_items || to_jsonb(v_item_record);

    -- 4. Deduct stock and log movement atomically if product exists
    IF v_prod_uuid IS NOT NULL THEN
      v_deduct_res := deduct_stock(
        v_prod_uuid,
        v_qty,
        'ONLINE',
        v_order_number,
        NULL
      );
    END IF;
  END LOOP;

  -- 5. Return created order header and all inserted items
  RETURN jsonb_build_object(
    'success', TRUE,
    'order', to_jsonb(v_created_order),
    'items', v_inserted_items
  );
END;
$$;

-- Grant permissions to public/anon and authenticated users
GRANT EXECUTE ON FUNCTION create_online_order_atomic(JSONB, JSONB) TO anon, authenticated, service_role;
