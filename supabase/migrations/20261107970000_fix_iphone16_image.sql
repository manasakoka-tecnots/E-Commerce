-- Update iPhone 16 Pro Max image to use local catalog path
UPDATE public.product_images
SET storage_path = 'catalog/iphone-16-pro-max-256gb.jpg',
    alt_text = 'Apple iPhone 16 Pro Max in Natural Titanium'
WHERE product_id IN (
  SELECT id FROM public.products WHERE name ILIKE '%iPhone 16 Pro Max%'
);

-- If no image row exists, insert one
INSERT INTO public.product_images (product_id, storage_path, alt_text, is_representative, "order")
SELECT p.id, 'catalog/iphone-16-pro-max-256gb.jpg', 'Apple iPhone 16 Pro Max in Natural Titanium', true, 0
FROM public.products p
WHERE p.name ILIKE '%iPhone 16 Pro Max%'
AND NOT EXISTS (
  SELECT 1 FROM public.product_images pi WHERE pi.product_id = p.id
);
