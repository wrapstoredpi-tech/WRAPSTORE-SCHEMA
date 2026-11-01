-- ============================================================
-- FIX ONLINE ORDERS STATUS FLOW & TRACKING COLUMNS
-- Target Database: ppwpedkqlgjvdosxabtf.supabase.co
-- Run this in Supabase Dashboard -> SQL Editor
-- ============================================================

-- 1. Extend online_orders table with tracking and refund columns
ALTER TABLE online_orders
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS courier_name TEXT,
  ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS refund_id TEXT,
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10,2) DEFAULT 0;

-- 2. Drop and recreate check constraint to explicitly include 'PACKED'
ALTER TABLE online_orders
  DROP CONSTRAINT IF EXISTS online_orders_order_status_check;

ALTER TABLE online_orders
  ADD CONSTRAINT online_orders_order_status_check
  CHECK (order_status IN (
    'PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED',
    'READY_FOR_PICKUP', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'
  ));

-- 3. Grant full permissions to authenticated and anon roles
GRANT ALL ON online_orders TO authenticated, anon, service_role;
GRANT ALL ON online_order_items TO authenticated, anon, service_role;

-- 4. Open RLS policy for online_orders so POS staff can update orders seamlessly
DROP POLICY IF EXISTS "Allow full access on online_orders" ON online_orders;
CREATE POLICY "Allow full access on online_orders" ON online_orders
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access on online_order_items" ON online_order_items;
CREATE POLICY "Allow full access on online_order_items" ON online_order_items
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Ensure supabase_realtime publication includes online_orders and online_order_items
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE online_orders;
    ALTER PUBLICATION supabase_realtime ADD TABLE online_order_items;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

