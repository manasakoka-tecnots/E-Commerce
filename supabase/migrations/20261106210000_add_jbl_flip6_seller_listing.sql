-- Add seller listing for JBL Flip 6 product by seller "luma twills"
INSERT INTO public.seller_listings (seller_id, product_id, price, stock, status, shipping_info)
VALUES (
  '81c9feac-2842-4bd8-80c8-afce86ae3efc',
  'f7502971-32a8-4192-8943-287050de6922',
  7999,
  25,
  'active',
  '{"details": "Free Shipping. Processing: 1-2 business days. Delivery: 3-7 business days."}'::jsonb
)
ON CONFLICT DO NOTHING;
