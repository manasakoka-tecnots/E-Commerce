ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_catalog_seed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS catalog_reference_price numeric(12, 2)
    CHECK (catalog_reference_price IS NULL OR catalog_reference_price >= 0);

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS license text,
  ADD COLUMN IF NOT EXISTS attribution text;

GRANT SELECT ON public.products, public.product_images TO anon, authenticated;

INSERT INTO public.categories (name)
VALUES
  ('Mobiles & Electronics'),
  ('Computers & Laptops'),
  ('Audio & Headphones'),
  ('Men''s Fashion'),
  ('Women''s Fashion'),
  ('Kids'' Fashion'),
  ('Footwear'),
  ('Home & Kitchen'),
  ('Furniture & Home Décor'),
  ('Beauty & Personal Care'),
  ('Grocery & Daily Essentials'),
  ('Health & Wellness'),
  ('Sports & Fitness'),
  ('Books & Stationery'),
  ('Toys & Baby Products'),
  ('Automotive Accessories'),
  ('Pet Supplies')
ON CONFLICT (name) DO NOTHING;

CREATE TEMP TABLE shopora_catalog_seed (
  category_name text NOT NULL,
  product_name text NOT NULL,
  brand text,
  model_number text NOT NULL,
  description text NOT NULL,
  specifications jsonb NOT NULL,
  catalog_reference_price numeric(12, 2),
  image_url text NOT NULL,
  image_alt text NOT NULL,
  image_source_url text NOT NULL,
  image_license text NOT NULL,
  image_attribution text NOT NULL
);

INSERT INTO shopora_catalog_seed VALUES
  (
    'Mobiles & Electronics',
    'Samsung Galaxy S24',
    'Samsung',
    'SM-S921',
    'Compact Galaxy smartphone with a 6.2-inch display and a triple rear camera system. Specifications describe the India launch variant; regional configurations can differ.',
    '{"subcategory":"Android smartphones","variant":"8 GB RAM, 128 GB storage","display":"6.2-inch Dynamic AMOLED 2X","rear_camera":"50 MP wide, 12 MP ultra-wide, 10 MP telephoto","battery":"4,000 mAh","reference_price_basis":"India launch price for the 128 GB variant; not a current seller offer"}',
    79999,
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/30/Samsung_Galaxy_S24_%28webtekno%29_001.png/960px-Samsung_Galaxy_S24_%28webtekno%29_001.png',
    'Samsung Galaxy S24 handset',
    'https://commons.wikimedia.org/wiki/File:Samsung_Galaxy_S24_(webtekno)_001.png',
    'CC BY 3.0',
    'webtekno'
  ),
  (
    'Mobiles & Electronics',
    'Samsung Galaxy S24 Ultra',
    'Samsung',
    'SM-S928',
    'Galaxy Ultra smartphone with an integrated S Pen and a high-resolution multi-camera system. Specifications describe the India launch variant; regional configurations can differ.',
    '{"subcategory":"Android smartphones","variant":"12 GB RAM, 256 GB storage","display":"6.8-inch Dynamic AMOLED 2X","rear_camera":"200 MP wide, 50 MP 5x telephoto, 10 MP 3x telephoto, 12 MP ultra-wide","battery":"5,000 mAh","reference_price_basis":"India launch price for the 256 GB variant; not a current seller offer"}',
    129999,
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/07/SAMSUNG_Galaxy_S24_Ultra_%282%29.jpg/960px-SAMSUNG_Galaxy_S24_Ultra_%282%29.jpg',
    'Samsung Galaxy S24 Ultra handset',
    'https://commons.wikimedia.org/wiki/File:SAMSUNG_Galaxy_S24_Ultra_(2).jpg',
    'CC BY-SA 4.0',
    'Dinkun Chen'
  ),
  (
    'Mobiles & Electronics',
    'Blackview A60 Smartphone',
    'Blackview',
    'A60',
    'Entry-level Android Go smartphone shown with its folio case. This older model is included as a catalog reference and may no longer be sold new.',
    '{"subcategory":"Android smartphones","display":"6.1-inch HD+","memory":"1 GB RAM, 16 GB storage","rear_camera":"Dual rear camera","battery":"4,080 mAh","software":"Android 8.1 Go edition"}',
    NULL,
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/be/Blackview_A60_Smartphone_Android_mobile_phone_and_folio_case.jpg/500px-Blackview_A60_Smartphone_Android_mobile_phone_and_folio_case.jpg',
    'Blackview A60 phone with its folio case',
    'https://commons.wikimedia.org/wiki/File:Blackview_A60_Smartphone_Android_mobile_phone_and_folio_case.jpg',
    'CC BY-SA 4.0',
    'Acabashi'
  ),
  (
    'Computers & Laptops',
    'HP EliteBook 840 G3',
    'HP',
    'EliteBook 840 G3',
    'Business-class 14-inch notebook. Processor, memory, storage, display and operating-system configuration vary by unit.',
    '{"subcategory":"Business laptops","display":"14-inch class","processor":"6th-generation Intel Core options; configuration varies","configuration_note":"Confirm exact CPU, memory, storage, battery condition and operating system with the seller"}',
    NULL,
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2b/HP_EliteBook_840_G3_IMG_20220831_215522.jpg/960px-HP_EliteBook_840_G3_IMG_20220831_215522.jpg',
    'HP EliteBook 840 G3 laptop',
    'https://commons.wikimedia.org/wiki/File:HP_EliteBook_840_G3_IMG_20220831_215522.jpg',
    'CC BY-SA 4.0',
    'Miguel Durán, Museo8bits'
  ),
  (
    'Computers & Laptops',
    'HP EliteBook 840 G4',
    'HP',
    'EliteBook 840 G4',
    '14-inch business notebook from the EliteBook 840 G4 generation. Component and display options vary by configuration.',
    '{"subcategory":"Business laptops","display":"14-inch class","processor":"7th-generation Intel Core options; configuration varies","configuration_note":"Confirm exact CPU, memory, storage, battery condition and operating system with the seller"}',
    NULL,
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d7/HP_EliteBook_840_G4.png/960px-HP_EliteBook_840_G4.png',
    'HP EliteBook 840 G4 laptop',
    'https://commons.wikimedia.org/wiki/File:HP_EliteBook_840_G4.png',
    'CC BY-SA 4.0',
    'Dienthoaiquangcao12'
  ),
  (
    'Computers & Laptops',
    'HP EliteBook 840 G8',
    'HP',
    'EliteBook 840 G8',
    '14-inch business notebook from the EliteBook 840 G8 generation. Component and display options vary by configuration.',
    '{"subcategory":"Business laptops","display":"14-inch class","processor":"11th-generation Intel Core options; configuration varies","configuration_note":"Confirm exact CPU, memory, storage, battery condition and operating system with the seller"}',
    NULL,
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9a/HP_EliteBook_840_G8.png/960px-HP_EliteBook_840_G8.png',
    'HP EliteBook 840 G8 laptop',
    'https://commons.wikimedia.org/wiki/File:HP_EliteBook_840_G8.png',
    'CC BY-SA 4.0',
    'Infinatious'
  ),
  (
    'Audio & Headphones',
    'Audio-Technica ATH-A500 Headphones',
    'Audio-Technica',
    'ATH-A500',
    'Closed-back over-ear headphones from Audio-Technica. This discontinued model is shown for catalog identification; availability and condition depend on sellers.',
    '{"subcategory":"Wired over-ear headphones","driver":"53 mm dynamic","frequency_response":"5–30,000 Hz","impedance":"48 ohms","max_input":"1,000 mW"}',
    NULL,
    'https://upload.wikimedia.org/wikipedia/commons/5/50/Audio-Technica_ATH-A500_%282%29.jpg',
    'Audio-Technica ATH-A500 headphones',
    'https://commons.wikimedia.org/wiki/File:Audio-Technica_ATH-A500_(2).jpg',
    'Public domain',
    'Iainf'
  ),
  (
    'Men''s Fashion',
    'Crew Clothing Striped Shirt',
    'Crew Clothing',
    'Striped Shirt',
    'Casual striped shirt made by Crew Clothing. The source photograph identifies the garment brand and pattern; exact size, fabric blend and fit must be confirmed for any seller listing.',
    '{"subcategory":"Men''s shirts","pattern":"Striped","fit_note":"Exact cut and sizing vary by garment"}',
    NULL,
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9c/Crew_Clothing_striped_shirt.jpg/960px-Crew_Clothing_striped_shirt.jpg',
    'Crew Clothing striped shirt',
    'https://commons.wikimedia.org/wiki/File:Crew_Clothing_striped_shirt.jpg',
    'CC BY 2.0',
    'Nigel Andrews'
  ),
  (
    'Footwear',
    'Adidas Superstar Sneakers',
    'Adidas',
    'Superstar',
    'Classic Adidas Superstar low-top sneaker with the signature shell toe. Materials and detailing may vary across editions and colorways.',
    '{"subcategory":"Lifestyle sneakers","style":"Low-top, shell-toe design","variant_note":"Colorway and materials vary by edition"}',
    NULL,
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/59/Adidas_Superstar_shoes_pair.jpg/960px-Adidas_Superstar_shoes_pair.jpg',
    'Pair of Adidas Superstar sneakers',
    'https://commons.wikimedia.org/wiki/File:Adidas_Superstar_shoes_pair.jpg',
    'CC BY 2.0',
    'Yahoo! Blog from Sunnyvale, California, USA'
  ),
  (
    'Furniture & Home Décor',
    'IKEA BILLY Narrow Bookcase',
    'IKEA',
    'BILLY',
    'Narrow dark-brown version of the IKEA BILLY bookcase, as identified by the image source. Exact dimensions and finish should be checked against the selected edition.',
    '{"subcategory":"Bookcases","configuration":"Narrow, dark-brown version","dimensions_note":"Dimensions and finish vary by edition"}',
    NULL,
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4d/Ikea_Billy_bookcase.jpg/960px-Ikea_Billy_bookcase.jpg',
    'Narrow dark-brown IKEA BILLY bookcase',
    'https://commons.wikimedia.org/wiki/File:Ikea_Billy_bookcase.jpg',
    'CC BY-SA 4.0',
    'Jakub Súkeník'
  ),
  (
    'Home & Kitchen',
    'Traditional Himachali Brass Cookware',
    NULL,
    'Himachali Brass Cookware',
    'Traditional Himachali cookware photographed in the Sainj Valley region of Himachal Pradesh. The source describes brass vessels used for rice, lentils and water; this is a cultural product reference, not a seller offer.',
    '{"subcategory":"Traditional cookware","material":"Brass","origin":"Sainj Valley, Himachal Pradesh","use":"Cooking rice, lentils and boiling water"}',
    NULL,
    'https://upload.wikimedia.org/wikipedia/commons/d/de/Himachali_cookware.jpg',
    'Traditional Himachali brass cookware',
    'https://commons.wikimedia.org/wiki/File:Himachali_cookware.jpg',
    'CC BY-SA 4.0',
    'Rajani Gairshail'
  ),
  (
    'Grocery & Daily Essentials',
    'Nutella Hazelnut Cocoa Spread',
    'Nutella',
    'Hazelnut Cocoa Spread',
    'Nutella hazelnut cocoa spread shown in a jar. The photograph does not establish package size, ingredients by region, or current availability; confirm the exact package on any seller offer.',
    '{"subcategory":"Packaged spreads","package_note":"Net weight and ingredient declaration vary by market; verify the seller''s package"}',
    NULL,
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3a/Maghrib_%26_Isha_time_special_Ramadan_Nutella_Jar.jpg/960px-Maghrib_%26_Isha_time_special_Ramadan_Nutella_Jar.jpg',
    'Nutella hazelnut cocoa spread jar',
    'https://commons.wikimedia.org/wiki/File:Maghrib_%26_Isha_time_special_Ramadan_Nutella_Jar.jpg',
    'CC BY-SA 4.0',
    'Sakhalinio'
  ),
  (
    'Health & Wellness',
    'Omron HEM-7000 Blood Pressure Monitor',
    'Omron',
    'HEM-7000',
    'Omron HEM-7000 blood-pressure monitor. This model reference does not imply medical advice or current availability.',
    '{"subcategory":"Blood-pressure monitors","model":"HEM-7000","use_note":"Use according to the product manual and consult a qualified health professional for medical concerns"}',
    NULL,
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/95/Omron_HEM-7000_20110121.jpg/960px-Omron_HEM-7000_20110121.jpg',
    'Omron HEM-7000 blood pressure monitor',
    'https://commons.wikimedia.org/wiki/File:Omron_HEM-7000_20110121.jpg',
    'CC BY-SA 3.0',
    'Mk2010'
  );

INSERT INTO public.products (
  name,
  brand,
  category_id,
  model_number,
  description,
  specifications,
  status,
  is_catalog_seed,
  catalog_reference_price
)
SELECT
  seed.product_name,
  seed.brand,
  category.id,
  seed.model_number,
  seed.description,
  seed.specifications,
  'approved',
  true,
  seed.catalog_reference_price
FROM shopora_catalog_seed AS seed
JOIN public.categories AS category
  ON category.name = seed.category_name
WHERE NOT EXISTS (
  SELECT 1
  FROM public.products AS existing
  WHERE existing.category_id = category.id
    AND existing.name = seed.product_name
    AND existing.brand IS NOT DISTINCT FROM seed.brand
    AND existing.model_number = seed.model_number
);

INSERT INTO public.product_images (
  product_id,
  storage_path,
  alt_text,
  source_url,
  license,
  attribution
)
SELECT
  product.id,
  seed.image_url,
  seed.image_alt,
  seed.image_source_url,
  seed.image_license,
  seed.image_attribution
FROM shopora_catalog_seed AS seed
JOIN public.categories AS category
  ON category.name = seed.category_name
JOIN public.products AS product
  ON product.category_id = category.id
  AND product.name = seed.product_name
  AND product.brand IS NOT DISTINCT FROM seed.brand
  AND product.model_number = seed.model_number
  AND product.status = 'approved'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.product_images AS existing_image
  WHERE existing_image.product_id = product.id
    AND existing_image.source_url = seed.image_source_url
);
