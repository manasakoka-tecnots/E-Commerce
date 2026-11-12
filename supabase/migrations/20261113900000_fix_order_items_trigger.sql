-- Drop the broken set_timestamp trigger on order_items
-- order_items doesn't have an updated_at column, so this trigger always fails on UPDATE
DROP TRIGGER IF EXISTS set_timestamp_order_items ON order_items;

-- Fix existing order data: set variant info for the shirt order (M / Blue)
UPDATE order_items
SET variant_id = '3b22a0db-59e5-46de-bcb6-10828d92748f',
    variant_title = 'M / Blue'
WHERE seller_listing_id = '9d0db05c-a8c0-4e04-a3e9-e66e095072a7'
  AND variant_id IS NULL;
