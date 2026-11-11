-- Add image_url column to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url text;

-- Seed existing categories with their known local images
UPDATE categories SET image_url = '/category-images/audio-headphones.jpg' WHERE lower(name) = 'audio & headphones';
UPDATE categories SET image_url = '/category-images/bluetooth-speakers.jpg' WHERE lower(name) = 'bluetooth speakers';
UPDATE categories SET image_url = '/category-images/cables-chargers.jpg' WHERE lower(name) = 'cables & chargers';
UPDATE categories SET image_url = '/category-images/mobiles-electronics.jpg' WHERE lower(name) = 'mobiles & electronics';
UPDATE categories SET image_url = '/category-images/computers-laptops.jpg' WHERE lower(name) = 'computers & laptops';
UPDATE categories SET image_url = '/category-images/mens-fashion.jpg' WHERE lower(name) = 'men''s fashion';
UPDATE categories SET image_url = '/category-images/womens-fashion.jpg' WHERE lower(name) = 'women''s fashion';
UPDATE categories SET image_url = '/category-images/kids-fashion.jpg' WHERE lower(name) = 'kids'' fashion';
UPDATE categories SET image_url = '/category-images/footwear.jpg' WHERE lower(name) = 'footwear';
UPDATE categories SET image_url = '/category-images/kitchen.jpg' WHERE lower(name) = 'home & kitchen';
UPDATE categories SET image_url = '/category-images/furniture-home-decor.jpg' WHERE lower(name) = 'furniture & home décor';
UPDATE categories SET image_url = '/category-images/beauty.jpg' WHERE lower(name) = 'beauty & personal care';
UPDATE categories SET image_url = '/category-images/grocery.jpg' WHERE lower(name) = 'grocery & daily essentials';
UPDATE categories SET image_url = '/category-images/health-wellness.jpg' WHERE lower(name) = 'health & wellness';
UPDATE categories SET image_url = '/category-images/sports.jpg' WHERE lower(name) = 'sports & fitness';
UPDATE categories SET image_url = '/category-images/books.jpg' WHERE lower(name) = 'books & stationery';
UPDATE categories SET image_url = '/category-images/toys.jpg' WHERE lower(name) = 'toys & baby products';
UPDATE categories SET image_url = '/category-images/automotive.jpg' WHERE lower(name) = 'automotive accessories';
UPDATE categories SET image_url = '/category-images/pets.jpg' WHERE lower(name) = 'pet supplies';
