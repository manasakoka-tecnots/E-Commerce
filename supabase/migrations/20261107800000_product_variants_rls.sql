-- Enable RLS on product_variants
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read variants
CREATE POLICY "anyone can read product_variants"
  ON product_variants FOR SELECT
  USING (true);

-- Allow sellers to insert variants for their own products
CREATE POLICY "sellers insert own product_variants"
  ON product_variants FOR INSERT
  WITH CHECK (
    product_id IN (
      SELECT p.id FROM products p
      WHERE p.seller_id = get_seller_id_for_user()
    )
  );

-- Allow sellers to update variants for their own products
CREATE POLICY "sellers update own product_variants"
  ON product_variants FOR UPDATE
  USING (
    product_id IN (
      SELECT p.id FROM products p
      WHERE p.seller_id = get_seller_id_for_user()
    )
  );

-- Allow sellers to delete variants for their own products
CREATE POLICY "sellers delete own product_variants"
  ON product_variants FOR DELETE
  USING (
    product_id IN (
      SELECT p.id FROM products p
      WHERE p.seller_id = get_seller_id_for_user()
    )
  );

-- Also allow anon key to insert (for seeding via API routes)
CREATE POLICY "anon_insert_product_variants"
  ON product_variants FOR INSERT
  WITH CHECK (true);
