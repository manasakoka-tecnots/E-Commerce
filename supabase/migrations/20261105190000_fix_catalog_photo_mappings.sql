UPDATE public.product_images AS image
SET storage_path = seed.storage_path,
    alt_text = seed.alt_text
FROM public.products AS product
JOIN (
  VALUES
    (
      'HP EliteBook 840 G3',
      'HP',
      'EliteBook 840 G3',
      'https://commons.wikimedia.org/wiki/File:HP_EliteBook_840_G3_IMG_20220831_215522.jpg',
      'catalog/photos/2ed46a79-3f4e9b30.jpg',
      'HP EliteBook 840 G3 laptop'
    ),
    (
      'HP EliteBook 840 G4',
      'HP',
      'EliteBook 840 G4',
      'https://commons.wikimedia.org/wiki/File:HP_EliteBook_840_G4.png',
      'catalog/photos/0e6caf43-b513f238.png',
      'HP EliteBook 840 G4 laptop'
    ),
    (
      'HP EliteBook 840 G8',
      'HP',
      'EliteBook 840 G8',
      'https://commons.wikimedia.org/wiki/File:HP_EliteBook_840_G8.png',
      'catalog/photos/d76a373b-e2f4c788.png',
      'HP EliteBook 840 G8 laptop'
    ),
    (
      'Crew Clothing Striped Shirt',
      'Crew Clothing',
      'Striped Shirt',
      'https://commons.wikimedia.org/wiki/File:Crew_Clothing_striped_shirt.jpg',
      'catalog/photos/84f61f62-ee9ad826.jpg',
      'Crew Clothing striped shirt'
    ),
    (
      'Adidas Superstar Sneakers',
      'Adidas',
      'Superstar',
      'https://commons.wikimedia.org/wiki/File:Adidas_Superstar_shoes_pair.jpg',
      'catalog/photos/86c62cc9-190c9d9d.jpg',
      'Pair of Adidas Superstar sneakers'
    ),
    (
      'IKEA BILLY Narrow Bookcase',
      'IKEA',
      'BILLY',
      'https://commons.wikimedia.org/wiki/File:Ikea_Billy_bookcase.jpg',
      'catalog/photos/52504f58-087c7378.jpg',
      'Narrow dark-brown IKEA BILLY bookcase'
    )
) AS seed(product_name, brand, model_number, source_url, storage_path, alt_text)
  ON product.name = seed.product_name
  AND product.brand = seed.brand
  AND product.model_number = seed.model_number
WHERE product.is_catalog_seed = true
  AND image.product_id = product.id
  AND image.source_url = seed.source_url;
