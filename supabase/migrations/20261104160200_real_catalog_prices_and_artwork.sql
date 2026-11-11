ALTER TABLE public.seller_listings
ADD COLUMN IF NOT EXISTS price_reference_url text,
ADD COLUMN IF NOT EXISTS price_checked_at date;

UPDATE public.products
SET name = 'Sony WH-CH520 Wireless On-Ear Headphones',
    brand = 'Sony',
    description = 'Lightweight wireless on-ear headphones with up to 50 hours of battery life and multipoint Bluetooth connection.',
    status = 'approved'
WHERE id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb004';

UPDATE public.products
SET name = 'JBL Go 4 Portable Bluetooth Speaker',
    brand = 'JBL',
    description = 'Compact portable Bluetooth speaker with a rugged, water- and dust-resistant design.',
    status = 'approved'
WHERE id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb005';

UPDATE public.products
SET name = 'Apple 20W USB-C Power Adapter',
    brand = 'Apple',
    description = 'Compact 20W USB-C power adapter for compatible iPhone and other USB-C devices. Charging cable sold separately.',
    status = 'approved'
WHERE id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb006';

UPDATE public.seller_listings
SET price = 2980.00,
    price_reference_url = 'https://www.reliancedigital.in/product/sony-wh-ch520-wireless-on-ear-bluetooth-headphones-with-mic-blue-ljmwxn',
    price_checked_at = CURRENT_DATE,
    status = 'active'
WHERE seller_id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb003'
  AND product_id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb004';

UPDATE public.seller_listings
SET price = 4499.00,
    price_reference_url = 'https://www.amazon.in/s?k=JBL+Go+4',
    price_checked_at = NULL,
    status = 'active'
WHERE seller_id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb003'
  AND product_id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb005';

UPDATE public.seller_listings
SET price = 1900.00,
    price_reference_url = 'https://www.apple.com/in/shop/accessories/all',
    price_checked_at = NULL,
    status = 'active'
WHERE seller_id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb003'
  AND product_id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb006';

DELETE FROM public.product_images
WHERE product_id IN (
  'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb004',
  'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb005',
  'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb006'
);

INSERT INTO public.product_images (product_id, storage_path, alt_text, "order")
VALUES
  (
    'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb004',
    'catalog/sony-wh-ch520.svg',
    'Original illustration of wireless on-ear headphones',
    0
  ),
  (
    'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb005',
    'catalog/jbl-go-4.svg',
    'Original illustration of a compact portable Bluetooth speaker',
    0
  ),
  (
    'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb006',
    'catalog/apple-20w-adapter.svg',
    'Original illustration of a USB-C power adapter',
    0
  );
