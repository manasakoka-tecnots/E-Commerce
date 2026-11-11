-- Add cancellation fields to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_details TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Create increment_stock RPC function for restoring stock on cancellation
CREATE OR REPLACE FUNCTION increment_stock(listing_id UUID, qty INT)
RETURNS void AS $$
BEGIN
  UPDATE seller_listings
  SET stock = stock + qty, updated_at = now()
  WHERE id = listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
