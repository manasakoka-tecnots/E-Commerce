ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS is_representative boolean NOT NULL DEFAULT false;

INSERT INTO public.product_images (
  product_id,
  storage_path,
  alt_text,
  source_url,
  license,
  attribution,
  is_representative
)
SELECT
  seed.product_id,
  seed.image_url,
  seed.image_alt,
  seed.source_url,
  'CC BY-SA 4.0',
  seed.attribution,
  true
FROM (
  VALUES
    (
      'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb004'::uuid,
      'https://upload.wikimedia.org/wikipedia/commons/0/01/Sony_WH-CH510_Bluetooth_Over-Ear_Headphone.jpg',
      'Representative photo of Sony WH-CH510 headphones; the listed model is WH-CH520.',
      'https://commons.wikimedia.org/wiki/File:Sony_WH-CH510_Bluetooth_Over-Ear_Headphone.jpg',
      'RPSkokie'
    ),
    (
      'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb005'::uuid,
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/JBL_Flip_4.jpg/960px-JBL_Flip_4.jpg',
      'Representative photo of a JBL Flip 4 speaker; the listed model is JBL Go 4.',
      'https://commons.wikimedia.org/wiki/File:JBL_Flip_4.jpg',
      'Freekhou5'
    ),
    (
      'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb006'::uuid,
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a8/Apple_5W_USB_Power_Adapter_%284935%29.jpg/960px-Apple_5W_USB_Power_Adapter_%284935%29.jpg',
      'Representative photo of an Apple 5W USB power adapter; the listed model is the 20W USB-C adapter.',
      'https://commons.wikimedia.org/wiki/File:Apple_5W_USB_Power_Adapter_(4935).jpg',
      'Gregory Varnum'
    )
) AS seed(product_id, image_url, image_alt, source_url, attribution)
WHERE EXISTS (
  SELECT 1
  FROM public.products AS product
  WHERE product.id = seed.product_id
)
AND NOT EXISTS (
  SELECT 1
  FROM public.product_images AS existing
  WHERE existing.product_id = seed.product_id
);

DELETE FROM public.products
WHERE id = '07891e65-d321-45b1-b74c-ba66eb382659'
  AND is_catalog_seed = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.seller_listings
    WHERE seller_listings.product_id = products.id
  );
