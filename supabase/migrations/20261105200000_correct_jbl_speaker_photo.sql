UPDATE public.product_images AS image
SET storage_path = 'catalog/photos/jbl-flip-4.jpg',
    alt_text = 'Representative photo of a JBL Flip 4 portable speaker; the listed model is JBL Go 4.',
    is_representative = true
FROM public.products AS product
WHERE product.id = image.product_id
  AND product.id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb005'::uuid
  AND product.name = 'JBL Go 4 Portable Bluetooth Speaker'
  AND image.source_url = 'https://commons.wikimedia.org/wiki/File:JBL_Flip_4.jpg';
