DELETE FROM public.product_images
WHERE
  (product_id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb004'
    AND storage_path = 'catalog/sony-wh-ch520.svg')
  OR
  (product_id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb005'
    AND storage_path = 'catalog/jbl-go-4.svg')
  OR
  (product_id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb006'
    AND storage_path = 'catalog/apple-20w-adapter.svg');
