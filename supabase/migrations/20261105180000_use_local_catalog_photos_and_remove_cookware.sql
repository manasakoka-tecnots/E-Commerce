UPDATE public.product_images AS image
SET storage_path = seed.storage_path,
    alt_text = seed.alt_text
FROM public.products AS product
JOIN (
  VALUES
    (
      'Samsung Galaxy S24',
      'Samsung',
      'SM-S921',
      'https://commons.wikimedia.org/wiki/File:Samsung_Galaxy_S24_(webtekno)_001.png',
      'catalog/photos/f1b6ea1e-665d871b.jpg',
      'Samsung Galaxy S24 handset'
    ),
    (
      'Samsung Galaxy S24 Ultra',
      'Samsung',
      'SM-S928',
      'https://commons.wikimedia.org/wiki/File:SAMSUNG_Galaxy_S24_Ultra_(2).jpg',
      'catalog/photos/11d35e69-c311e836.jpg',
      'Samsung Galaxy S24 Ultra handset'
    ),
    (
      'Blackview A60 Smartphone',
      'Blackview',
      'A60',
      'https://commons.wikimedia.org/wiki/File:Blackview_A60_Smartphone_Android_mobile_phone_and_folio_case.jpg',
      'catalog/photos/2dd8b020-56a141e6.jpg',
      'Blackview A60 phone with its folio case'
    ),
    (
      'HP EliteBook 840 G3',
      'HP',
      'EliteBook 840 G3',
      'https://commons.wikimedia.org/wiki/File:HP_EliteBook_840_G3_IMG_20220831_215522.jpg',
      'catalog/photos/0e6caf43-b513f238.png',
      'HP EliteBook 840 G3 laptop'
    ),
    (
      'HP EliteBook 840 G4',
      'HP',
      'EliteBook 840 G4',
      'https://commons.wikimedia.org/wiki/File:HP_EliteBook_840_G4.png',
      'catalog/photos/2ed46a79-3f4e9b30.jpg',
      'HP EliteBook 840 G4 laptop'
    ),
    (
      'HP EliteBook 840 G8',
      'HP',
      'EliteBook 840 G8',
      'https://commons.wikimedia.org/wiki/File:HP_EliteBook_840_G8.png',
      'catalog/photos/84f61f62-ee9ad826.jpg',
      'HP EliteBook 840 G8 laptop'
    ),
    (
      'Audio-Technica ATH-A500 Headphones',
      'Audio-Technica',
      'ATH-A500',
      'https://commons.wikimedia.org/wiki/File:Audio-Technica_ATH-A500_(2).jpg',
      'catalog/photos/2db4f2c6-ffee751e.jpg',
      'Audio-Technica ATH-A500 headphones'
    ),
    (
      'Crew Clothing Striped Shirt',
      'Crew Clothing',
      'Striped Shirt',
      'https://commons.wikimedia.org/wiki/File:Crew_Clothing_striped_shirt.jpg',
      'catalog/photos/52504f58-087c7378.jpg',
      'Crew Clothing striped shirt'
    ),
    (
      'Adidas Superstar Sneakers',
      'Adidas',
      'Superstar',
      'https://commons.wikimedia.org/wiki/File:Adidas_Superstar_shoes_pair.jpg',
      'catalog/photos/d76a373b-e2f4c788.png',
      'Pair of Adidas Superstar sneakers'
    ),
    (
      'IKEA BILLY Narrow Bookcase',
      'IKEA',
      'BILLY',
      'https://commons.wikimedia.org/wiki/File:Ikea_Billy_bookcase.jpg',
      'catalog/photos/86c62cc9-190c9d9d.jpg',
      'Narrow dark-brown IKEA BILLY bookcase'
    ),
    (
      'Nutella Hazelnut Cocoa Spread',
      'Nutella',
      'Hazelnut Cocoa Spread',
      'https://commons.wikimedia.org/wiki/File:Maghrib_%26_Isha_time_special_Ramadan_Nutella_Jar.jpg',
      'catalog/photos/ab7a661c-116a44ae.jpg',
      'Nutella hazelnut cocoa spread jar'
    ),
    (
      'Omron HEM-7000 Blood Pressure Monitor',
      'Omron',
      'HEM-7000',
      'https://commons.wikimedia.org/wiki/File:Omron_HEM-7000_20110121.jpg',
      'catalog/photos/f4c13a0e-8f2d525a.jpg',
      'Omron HEM-7000 blood pressure monitor'
    )
) AS seed(product_name, brand, model_number, source_url, storage_path, alt_text)
  ON product.name = seed.product_name
  AND product.brand = seed.brand
  AND product.model_number = seed.model_number
WHERE product.is_catalog_seed = true
  AND image.product_id = product.id
  AND image.source_url = seed.source_url;

UPDATE public.product_images AS image
SET storage_path = seed.storage_path,
    alt_text = seed.alt_text
FROM (
  VALUES
    (
      'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb004'::uuid,
      'https://commons.wikimedia.org/wiki/File:Sony_WH-CH510_Bluetooth_Over-Ear_Headphone.jpg',
      'catalog/photos/f1b6ea1e-sony.jpg',
      'Representative photo of Sony WH-CH510 headphones; the listed model is WH-CH520.'
    ),
    (
      'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb005'::uuid,
      'https://commons.wikimedia.org/wiki/File:JBL_Flip_4.jpg',
      'catalog/photos/d9205166-cc94440d.png',
      'Representative photo of a JBL Flip 4 speaker; the listed model is JBL Go 4.'
    ),
    (
      'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb006'::uuid,
      'https://commons.wikimedia.org/wiki/File:Apple_5W_USB_Power_Adapter_(4935).jpg',
      'catalog/photos/f1b6ea1e-8d79cea1.jpg',
      'Representative photo of an Apple 5W USB power adapter; the listed model is the 20W USB-C adapter.'
    )
) AS seed(product_id, source_url, storage_path, alt_text)
WHERE image.product_id = seed.product_id
  AND image.source_url = seed.source_url;

DELETE FROM public.products AS product
WHERE product.is_catalog_seed = true
  AND product.name = 'Traditional Himachali Brass Cookware'
  AND product.model_number = 'Himachali Brass Cookware'
  AND NOT EXISTS (
    SELECT 1
    FROM public.seller_listings AS listing
    WHERE listing.product_id = product.id
  );
