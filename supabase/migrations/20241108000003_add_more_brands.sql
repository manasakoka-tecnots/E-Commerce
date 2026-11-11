-- Add new brands: Clothing & Fashion, more Sportswear, more Electronics, Audio, Home & Kitchen
INSERT INTO brands (name, slug, logo_url, description, category) VALUES
  ('Under Armour', 'under-armour', '/brand-logos/under-armour.svg', 'The Only Way Is Through — Performance apparel, footwear, and accessories.', 'Sportswear & Footwear'),
  ('Reebok', 'reebok', '/brand-logos/reebok.svg', 'Life is Not a Spectator Sport — Fitness and lifestyle footwear and apparel.', 'Sportswear & Footwear'),
  ('Zara', 'zara', '/brand-logos/zara.svg', 'Fast fashion leader with trendy, affordable clothing for men, women, and kids.', 'Clothing & Fashion'),
  ('H&M', 'hm', '/brand-logos/hm.svg', 'Fashion and quality at the best price in a sustainable way.', 'Clothing & Fashion'),
  ('Uniqlo', 'uniqlo', '/brand-logos/uniqlo.svg', 'LifeWear — Simple, high-quality everyday clothing for everyone.', 'Clothing & Fashion'),
  ('Levi''s', 'levis', '/brand-logos/levis.svg', 'Quality Never Goes Out of Style — Iconic denim jeans and casual wear since 1853.', 'Clothing & Fashion'),
  ('Xiaomi', 'xiaomi', '/brand-logos/xiaomi.svg', 'Innovation for Everyone — Smartphones, smart home devices, and electronics at great value.', 'Electronics'),
  ('OnePlus', 'oneplus', '/brand-logos/oneplus.svg', 'Never Settle — Premium smartphones and tech accessories.', 'Electronics'),
  ('boAt', 'boat', '/brand-logos/boat.svg', 'Plug Into Nirvana — India''s #1 audio and wearables brand.', 'Audio'),
  ('IKEA', 'ikea', '/brand-logos/ikea.svg', 'Creating a better everyday life — Affordable furniture, home accessories, and smart solutions.', 'Home & Kitchen'),
  ('Bosch', 'bosch', '/brand-logos/bosch.svg', 'Invented for Life — Home appliances, power tools, and smart home solutions.', 'Home & Kitchen')
ON CONFLICT (slug) DO NOTHING;
