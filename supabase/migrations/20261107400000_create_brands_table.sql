-- Create brands table for marketplace-wide brand management
-- Sellers can add new brands, which appear on the customer-facing brands page

CREATE TABLE IF NOT EXISTS brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  logo_url text,
  description text,
  category text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Allow anyone to read brands
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view brands"
  ON brands FOR SELECT
  USING (true);

-- Sellers and admins can insert new brands
CREATE POLICY "Sellers and admins can create brands"
  ON brands FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_uid = auth.uid()
      AND profiles.role IN ('seller', 'admin')
    )
  );

-- Only admins can update/delete brands
CREATE POLICY "Admins can update brands"
  ON brands FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_uid = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Grant permissions
GRANT SELECT ON brands TO anon, authenticated;
GRANT INSERT ON brands TO authenticated;
GRANT UPDATE, DELETE ON brands TO authenticated;

-- Seed the 10 default brands
INSERT INTO brands (name, slug, logo_url, description, category) VALUES
  ('Nike', 'nike', 'https://logo.clearbit.com/nike.com', 'Just Do It — World''s leading sportswear and athletic footwear brand.', 'Sportswear & Footwear'),
  ('Adidas', 'adidas', 'https://logo.clearbit.com/adidas.com', 'Impossible Is Nothing — Global sportswear manufacturer known for the iconic three stripes.', 'Sportswear & Footwear'),
  ('Puma', 'puma', 'https://logo.clearbit.com/puma.com', 'Forever Faster — Premium athletic and lifestyle brand for sports enthusiasts.', 'Sportswear & Footwear'),
  ('Samsung', 'samsung', 'https://logo.clearbit.com/samsung.com', 'Innovation leader in smartphones, TVs, home appliances, and semiconductors.', 'Electronics'),
  ('Apple', 'apple', 'https://logo.clearbit.com/apple.com', 'Think Different — Premium consumer electronics, software, and services.', 'Electronics'),
  ('Sony', 'sony', 'https://logo.clearbit.com/sony.com', 'Be Moved — Electronics, gaming, entertainment, and professional solutions.', 'Electronics'),
  ('HP', 'hp', 'https://logo.clearbit.com/hp.com', 'Keep Reinventing — Computers, printers, and technology solutions for everyone.', 'Computers & Laptops'),
  ('Dell', 'dell', 'https://logo.clearbit.com/dell.com', 'Technology that drives human progress — PCs, monitors, and enterprise solutions.', 'Computers & Laptops'),
  ('Lenovo', 'lenovo', 'https://logo.clearbit.com/lenovo.com', 'Smarter Technology for All — World''s largest PC vendor with ThinkPad and IdeaPad lines.', 'Computers & Laptops'),
  ('JBL', 'jbl', 'https://logo.clearbit.com/jbl.com', 'Dare to Listen — Premium speakers, headphones, and audio equipment.', 'Audio')
ON CONFLICT (name) DO NOTHING;
