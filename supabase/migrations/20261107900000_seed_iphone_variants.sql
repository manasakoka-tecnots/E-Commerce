-- Insert variants for iPhone 16 Pro Max
DO $$
DECLARE
  v_product_id UUID;
BEGIN
  SELECT id INTO v_product_id FROM products WHERE name ILIKE '%iPhone 16 Pro Max%' LIMIT 1;
  
  IF v_product_id IS NULL THEN
    RAISE NOTICE 'iPhone product not found, skipping';
    RETURN;
  END IF;

  -- Delete existing variants if any
  DELETE FROM product_variants WHERE product_id = v_product_id;

  -- Insert 12 variants (3 storage × 4 colors)
  INSERT INTO product_variants (product_id, title, sku, price, stock, is_available, option1_name, option1_value, option2_name, option2_value) VALUES
    (v_product_id, '256 GB / Black Titanium', 'APPLE-IP16PM-256GB-BLA-001', 134900, 25, true, 'Storage', '256 GB', 'Color', 'Black Titanium'),
    (v_product_id, '256 GB / Natural Titanium', 'APPLE-IP16PM-256GB-NAT-002', 134900, 25, true, 'Storage', '256 GB', 'Color', 'Natural Titanium'),
    (v_product_id, '256 GB / White Titanium', 'APPLE-IP16PM-256GB-WHI-003', 134900, 25, true, 'Storage', '256 GB', 'Color', 'White Titanium'),
    (v_product_id, '256 GB / Desert Titanium', 'APPLE-IP16PM-256GB-DES-004', 134900, 25, true, 'Storage', '256 GB', 'Color', 'Desert Titanium'),
    (v_product_id, '512 GB / Black Titanium', 'APPLE-IP16PM-512GB-BLA-005', 154900, 20, true, 'Storage', '512 GB', 'Color', 'Black Titanium'),
    (v_product_id, '512 GB / Natural Titanium', 'APPLE-IP16PM-512GB-NAT-006', 154900, 20, true, 'Storage', '512 GB', 'Color', 'Natural Titanium'),
    (v_product_id, '512 GB / White Titanium', 'APPLE-IP16PM-512GB-WHI-007', 154900, 20, true, 'Storage', '512 GB', 'Color', 'White Titanium'),
    (v_product_id, '512 GB / Desert Titanium', 'APPLE-IP16PM-512GB-DES-008', 154900, 20, true, 'Storage', '512 GB', 'Color', 'Desert Titanium'),
    (v_product_id, '1 TB / Black Titanium', 'APPLE-IP16PM-1TB-BLA-009', 174900, 15, true, 'Storage', '1 TB', 'Color', 'Black Titanium'),
    (v_product_id, '1 TB / Natural Titanium', 'APPLE-IP16PM-1TB-NAT-010', 174900, 15, true, 'Storage', '1 TB', 'Color', 'Natural Titanium'),
    (v_product_id, '1 TB / White Titanium', 'APPLE-IP16PM-1TB-WHI-011', 174900, 15, true, 'Storage', '1 TB', 'Color', 'White Titanium'),
    (v_product_id, '1 TB / Desert Titanium', 'APPLE-IP16PM-1TB-DES-012', 174900, 15, true, 'Storage', '1 TB', 'Color', 'Desert Titanium');

  -- Insert seller listing if not exists
  INSERT INTO seller_listings (seller_id, product_id, price, stock, status, shipping_info)
  SELECT 
    p.seller_id,
    p.id,
    134900,
    300,
    'active',
    '{"details": "Free Shipping. Processing: 1-2 business days. Delivery: 3-5 business days."}'::jsonb
  FROM products p
  WHERE p.id = v_product_id
  AND NOT EXISTS (
    SELECT 1 FROM seller_listings sl WHERE sl.product_id = v_product_id
  );

  RAISE NOTICE 'iPhone 16 Pro Max: 12 variants and listing added successfully';
END $$;
