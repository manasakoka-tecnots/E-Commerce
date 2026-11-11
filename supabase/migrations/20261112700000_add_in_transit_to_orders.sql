-- Add 'in_transit' to the orders status constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','confirmed','processing','shipped','in_transit','out_for_delivery','delivered','cancelled'));
