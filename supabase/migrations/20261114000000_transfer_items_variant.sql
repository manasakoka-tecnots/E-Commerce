-- Add variant support to transfer_items
ALTER TABLE transfer_items
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_title text;

-- Index for faster variant-level lookups
CREATE INDEX IF NOT EXISTS idx_transfer_items_variant
  ON transfer_items(variant_id) WHERE variant_id IS NOT NULL;
