INSERT INTO public.profiles (id, auth_uid, email, full_name, role)
VALUES (
  'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb001',
  'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb002',
  'catalog-demo-seller@seed.invalid',
  'Demo Catalog Seller',
  'seller'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.sellers (id, profile_id, business_name, status)
VALUES (
  'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb003',
  'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb001',
  'Demo Catalog Store',
  'approved'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.products (id, name, brand, description, status)
VALUES
  (
    'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb004',
    'Everyday Wireless Headphones',
    'Market Demo',
    'Comfortable wireless headphones for work and travel.',
    'approved'
  ),
  (
    'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb005',
    'Portable Bluetooth Speaker',
    'Market Demo',
    'A compact speaker for music at home or on the go.',
    'approved'
  ),
  (
    'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb006',
    'USB-C Fast Charger',
    'Market Demo',
    'A compact USB-C charger for compatible devices.',
    'approved'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seller_listings (seller_id, product_id, price, stock, status)
VALUES
  (
    'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb003',
    'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb004',
    49.99,
    25,
    'active'
  ),
  (
    'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb003',
    'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb005',
    34.50,
    18,
    'active'
  ),
  (
    'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb003',
    'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb006',
    19.99,
    40,
    'active'
  )
ON CONFLICT (seller_id, product_id) DO NOTHING;
