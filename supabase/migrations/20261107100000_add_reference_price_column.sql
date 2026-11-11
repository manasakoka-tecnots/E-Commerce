-- Add reference_price (compare-at / MRP) column to seller_listings
-- Used to show Diwali discount strikethrough prices on the storefront.
ALTER TABLE public.seller_listings
  ADD COLUMN IF NOT EXISTS reference_price numeric;

COMMENT ON COLUMN public.seller_listings.reference_price
  IS 'Compare-at / MRP price shown as strikethrough to highlight discount';
