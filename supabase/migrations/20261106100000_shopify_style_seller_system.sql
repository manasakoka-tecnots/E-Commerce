-- =============================================================================
-- Migration: Shopify-style Seller System for Shopora
-- Date: 2026-11-06
-- Description: Adds extended product fields, variants, collections, discounts,
--              seller pages, seller files, payouts, marketing campaigns,
--              seller settings, RLS policies, and updated_at triggers.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Helper function: get the approved seller_id for the current auth user
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_seller_id_for_user() RETURNS UUID AS $$
  SELECT s.id FROM sellers s
  JOIN profiles p ON p.id = s.profile_id
  WHERE p.auth_uid = auth.uid()
  AND s.status = 'approved'
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---------------------------------------------------------------------------
-- 1. Extended product fields (ALTER TABLE products)
-- ---------------------------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_per_item NUMERIC(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_applicable BOOLEAN DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS track_quantity BOOLEAN DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS continue_selling_when_oos BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 5;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_physical_product BOOLEAN DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC(8,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_unit TEXT DEFAULT 'kg';
ALTER TABLE products ADD COLUMN IF NOT EXISTS package_length NUMERIC(8,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS package_width NUMERIC(8,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS package_height NUMERIC(8,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS country_of_origin TEXT DEFAULT 'India';
ALTER TABLE products ADD COLUMN IF NOT EXISTS hs_code TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS processing_time TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_duration TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS shipping_restrictions TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS fulfillment_notes TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_title TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS url_handle TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Update status check constraint to allow new statuses
DO $$ BEGIN
  -- Drop existing constraint if it exists, then recreate with expanded values
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'products'
      AND constraint_type = 'CHECK'
      AND constraint_name = 'products_status_check'
  ) THEN
    ALTER TABLE products DROP CONSTRAINT products_status_check;
  END IF;

  -- Also handle the auto-generated constraint name pattern
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'products'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
  ) THEN
    -- Find and drop all check constraints on status
    DECLARE
      _cname TEXT;
    BEGIN
      FOR _cname IN
        SELECT con.conname
        FROM pg_constraint con
        WHERE con.conrelid = 'products'::regclass
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) LIKE '%status%'
      LOOP
        EXECUTE format('ALTER TABLE products DROP CONSTRAINT %I', _cname);
      END LOOP;
    END;
  END IF;
END $$;

-- Now add the expanded status constraint
DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_status_check
    CHECK (status IN ('draft', 'active', 'archived', 'approved', 'pending', 'rejected'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Product variants table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sku TEXT,
  price NUMERIC(10,2),
  compare_at_price NUMERIC(10,2),
  stock INTEGER DEFAULT 0,
  image_url TEXT,
  option1_name TEXT,
  option1_value TEXT,
  option2_name TEXT,
  option2_value TEXT,
  option3_name TEXT,
  option3_value TEXT,
  is_available BOOLEAN DEFAULT true,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);

-- ---------------------------------------------------------------------------
-- 3. Collections tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  sort_order TEXT DEFAULT 'manual',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collection_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(collection_id, product_id)
);

-- ---------------------------------------------------------------------------
-- 4. Discounts tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed_amount', 'free_shipping')),
  value NUMERIC(10,2) NOT NULL,
  minimum_purchase NUMERIC(10,2) DEFAULT 0,
  usage_limit INTEGER,
  used_count INTEGER DEFAULT 0,
  applies_to TEXT DEFAULT 'all' CHECK (applies_to IN ('all', 'specific_products', 'specific_collections')),
  start_date TIMESTAMPTZ DEFAULT now(),
  end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  is_automatic BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_discounts_code_seller ON discounts(seller_id, code);

CREATE TABLE IF NOT EXISTS discount_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_id UUID NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE(discount_id, product_id)
);

-- ---------------------------------------------------------------------------
-- 5. Seller pages table (Online Store content)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seller_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  body TEXT,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(seller_id, slug)
);

-- ---------------------------------------------------------------------------
-- 6. Seller files table (Content management)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seller_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  alt_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 7. Seller settings (extend sellers table)
-- ---------------------------------------------------------------------------
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS store_description TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS store_logo_url TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS store_banner_url TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS support_email TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS support_phone TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS return_policy TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS shipping_policy TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS payment_info JSONB DEFAULT '{}';
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email_orders": true, "email_stock": true}';

-- ---------------------------------------------------------------------------
-- 8. Seller payouts table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seller_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  payout_method TEXT,
  reference_id TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 9. Marketing campaigns table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'manual' CHECK (type IN ('manual', 'automated')),
  channel TEXT DEFAULT 'email',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  budget NUMERIC(10,2),
  spent NUMERIC(10,2) DEFAULT 0,
  reach INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 10. Enable RLS on all new tables
-- ---------------------------------------------------------------------------
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;

-- ---- Helper: check if current user is admin ----
CREATE OR REPLACE FUNCTION is_admin_user() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE auth_uid = auth.uid()
      AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =========================================================================
-- RLS Policies: product_variants
-- =========================================================================
-- Sellers manage variants on their own products
DO $$ BEGIN
  DROP POLICY IF EXISTS "Sellers manage own product variants" ON product_variants;
END $$;
CREATE POLICY "Sellers manage own product variants" ON product_variants
  FOR ALL
  USING (
    product_id IN (
      SELECT p.id FROM products p WHERE p.seller_id = get_seller_id_for_user()
    )
  )
  WITH CHECK (
    product_id IN (
      SELECT p.id FROM products p WHERE p.seller_id = get_seller_id_for_user()
    )
  );

-- Public can read variants of active products
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read active product variants" ON product_variants;
END $$;
CREATE POLICY "Public read active product variants" ON product_variants
  FOR SELECT
  USING (
    product_id IN (
      SELECT p.id FROM products p WHERE p.status = 'active'
    )
  );

-- Admins can read all variants
DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins read all product variants" ON product_variants;
END $$;
CREATE POLICY "Admins read all product variants" ON product_variants
  FOR SELECT
  USING (is_admin_user());

-- =========================================================================
-- RLS Policies: collections
-- =========================================================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "Sellers manage own collections" ON collections;
END $$;
CREATE POLICY "Sellers manage own collections" ON collections
  FOR ALL
  USING (seller_id = get_seller_id_for_user())
  WITH CHECK (seller_id = get_seller_id_for_user());

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read active collections" ON collections;
END $$;
CREATE POLICY "Public read active collections" ON collections
  FOR SELECT
  USING (is_active = true);

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins read all collections" ON collections;
END $$;
CREATE POLICY "Admins read all collections" ON collections
  FOR SELECT
  USING (is_admin_user());

-- =========================================================================
-- RLS Policies: collection_products
-- =========================================================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "Sellers manage own collection products" ON collection_products;
END $$;
CREATE POLICY "Sellers manage own collection products" ON collection_products
  FOR ALL
  USING (
    collection_id IN (
      SELECT c.id FROM collections c WHERE c.seller_id = get_seller_id_for_user()
    )
  )
  WITH CHECK (
    collection_id IN (
      SELECT c.id FROM collections c WHERE c.seller_id = get_seller_id_for_user()
    )
  );

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read active collection products" ON collection_products;
END $$;
CREATE POLICY "Public read active collection products" ON collection_products
  FOR SELECT
  USING (
    collection_id IN (
      SELECT c.id FROM collections c WHERE c.is_active = true
    )
  );

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins read all collection products" ON collection_products;
END $$;
CREATE POLICY "Admins read all collection products" ON collection_products
  FOR SELECT
  USING (is_admin_user());

-- =========================================================================
-- RLS Policies: discounts
-- =========================================================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "Sellers manage own discounts" ON discounts;
END $$;
CREATE POLICY "Sellers manage own discounts" ON discounts
  FOR ALL
  USING (seller_id = get_seller_id_for_user())
  WITH CHECK (seller_id = get_seller_id_for_user());

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read active discounts" ON discounts;
END $$;
CREATE POLICY "Public read active discounts" ON discounts
  FOR SELECT
  USING (
    is_active = true
    AND (start_date IS NULL OR start_date <= now())
    AND (end_date IS NULL OR end_date >= now())
  );

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins read all discounts" ON discounts;
END $$;
CREATE POLICY "Admins read all discounts" ON discounts
  FOR SELECT
  USING (is_admin_user());

-- =========================================================================
-- RLS Policies: discount_products
-- =========================================================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "Sellers manage own discount products" ON discount_products;
END $$;
CREATE POLICY "Sellers manage own discount products" ON discount_products
  FOR ALL
  USING (
    discount_id IN (
      SELECT d.id FROM discounts d WHERE d.seller_id = get_seller_id_for_user()
    )
  )
  WITH CHECK (
    discount_id IN (
      SELECT d.id FROM discounts d WHERE d.seller_id = get_seller_id_for_user()
    )
  );

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read active discount products" ON discount_products;
END $$;
CREATE POLICY "Public read active discount products" ON discount_products
  FOR SELECT
  USING (
    discount_id IN (
      SELECT d.id FROM discounts d
      WHERE d.is_active = true
        AND (d.start_date IS NULL OR d.start_date <= now())
        AND (d.end_date IS NULL OR d.end_date >= now())
    )
  );

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins read all discount products" ON discount_products;
END $$;
CREATE POLICY "Admins read all discount products" ON discount_products
  FOR SELECT
  USING (is_admin_user());

-- =========================================================================
-- RLS Policies: seller_pages
-- =========================================================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "Sellers manage own pages" ON seller_pages;
END $$;
CREATE POLICY "Sellers manage own pages" ON seller_pages
  FOR ALL
  USING (seller_id = get_seller_id_for_user())
  WITH CHECK (seller_id = get_seller_id_for_user());

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read published pages" ON seller_pages;
END $$;
CREATE POLICY "Public read published pages" ON seller_pages
  FOR SELECT
  USING (is_published = true);

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins read all pages" ON seller_pages;
END $$;
CREATE POLICY "Admins read all pages" ON seller_pages
  FOR SELECT
  USING (is_admin_user());

-- =========================================================================
-- RLS Policies: seller_files
-- =========================================================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "Sellers manage own files" ON seller_files;
END $$;
CREATE POLICY "Sellers manage own files" ON seller_files
  FOR ALL
  USING (seller_id = get_seller_id_for_user())
  WITH CHECK (seller_id = get_seller_id_for_user());

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins read all files" ON seller_files;
END $$;
CREATE POLICY "Admins read all files" ON seller_files
  FOR SELECT
  USING (is_admin_user());

-- =========================================================================
-- RLS Policies: seller_payouts
-- =========================================================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "Sellers read own payouts" ON seller_payouts;
END $$;
CREATE POLICY "Sellers read own payouts" ON seller_payouts
  FOR SELECT
  USING (seller_id = get_seller_id_for_user());

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins manage all payouts" ON seller_payouts;
END $$;
CREATE POLICY "Admins manage all payouts" ON seller_payouts
  FOR ALL
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- =========================================================================
-- RLS Policies: marketing_campaigns
-- =========================================================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "Sellers manage own campaigns" ON marketing_campaigns;
END $$;
CREATE POLICY "Sellers manage own campaigns" ON marketing_campaigns
  FOR ALL
  USING (seller_id = get_seller_id_for_user())
  WITH CHECK (seller_id = get_seller_id_for_user());

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins read all campaigns" ON marketing_campaigns;
END $$;
CREATE POLICY "Admins read all campaigns" ON marketing_campaigns
  FOR SELECT
  USING (is_admin_user());

-- ---------------------------------------------------------------------------
-- 11. updated_at triggers for all new tables with updated_at
-- ---------------------------------------------------------------------------

-- Reusable trigger function (create if not exists)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- product_variants
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_product_variants_updated_at'
  ) THEN
    CREATE TRIGGER trg_product_variants_updated_at
      BEFORE UPDATE ON product_variants
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- collections
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_collections_updated_at'
  ) THEN
    CREATE TRIGGER trg_collections_updated_at
      BEFORE UPDATE ON collections
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- discounts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_discounts_updated_at'
  ) THEN
    CREATE TRIGGER trg_discounts_updated_at
      BEFORE UPDATE ON discounts
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- seller_pages
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_seller_pages_updated_at'
  ) THEN
    CREATE TRIGGER trg_seller_pages_updated_at
      BEFORE UPDATE ON seller_pages
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- seller_payouts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_seller_payouts_updated_at'
  ) THEN
    CREATE TRIGGER trg_seller_payouts_updated_at
      BEFORE UPDATE ON seller_payouts
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- marketing_campaigns
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_marketing_campaigns_updated_at'
  ) THEN
    CREATE TRIGGER trg_marketing_campaigns_updated_at
      BEFORE UPDATE ON marketing_campaigns
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- =============================================================================
-- Migration complete
-- =============================================================================
