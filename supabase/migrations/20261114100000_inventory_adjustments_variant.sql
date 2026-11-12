-- Add variant tracking columns to inventory_adjustments
ALTER TABLE inventory_adjustments
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_title text;

-- Index for efficient lookups by variant
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_variant_id
  ON inventory_adjustments(variant_id)
  WHERE variant_id IS NOT NULL;
