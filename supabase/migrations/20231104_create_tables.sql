/**
 * Supabase migration – create core tables for Multi‑Vendor Marketplace
 * Run with: supabase db push
 */

-- Enable pgcrypto for UUID generation
create extension if not exists "pgcrypto";

-- 1. profiles – generic user profile (customer, seller, admin)
create table profiles (
  id uuid primary key default gen_random_uuid(),
  auth_uid uuid not null unique, -- matches supabase.auth.users.id
  email text not null unique,
  full_name text,
  role text check (role in ('customer', 'seller', 'admin')) default 'customer',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);




-- 2. sellers – additional seller‑specific data
create table sellers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  business_name text not null,
  business_address text,
  business_type text,
  gst_number text,
  bank_details jsonb,
  status text check (status in ('pending', 'approved', 'rejected', 'suspended')) default 'pending',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 3. categories
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 4. products – shared catalog
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  category_id uuid references categories(id),
  model_number text,
  description text,
  specifications jsonb,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 5. product_images
create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  storage_path text not null,
  alt_text text,
  "order" integer default 0,
  created_at timestamp with time zone default now()
);

-- 6. seller_listings – each seller’s offer for a product
create table seller_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references sellers(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  price numeric(12,2) not null check (price >= 0),
  stock integer not null check (stock >= 0),
  condition text,
  shipping_info jsonb,
  warranty_info text,
  status text check (status in ('active', 'inactive', 'pending')) default 'pending',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (seller_id, product_id) -- one listing per seller per product
);

-- 7. addresses – customer delivery addresses
create table addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  label text,
  line1 text not null,
  line2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  country text not null,
  is_default boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 8. cart_items – temporary shopping‑cart storage
create table cart_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  seller_listing_id uuid not null references seller_listings(id),
  quantity integer not null check (quantity > 0),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 9. orders – top‑level order record
create table orders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  address_id uuid not null references addresses(id),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  status text check (status in (
    'pending','confirmed','processing','shipped','out_for_delivery','delivered','cancelled'
  )) default 'pending',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 10. order_items – each line item tied to a seller
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  seller_listing_id uuid not null references seller_listings(id),
  quantity integer not null check (quantity > 0),
  price_at_purchase numeric(12,2) not null check (price_at_purchase >= 0),
  created_at timestamp with time zone default now()
);

-- 11. reviews – product reviews by customers
create table reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamp with time zone default now()
);

-- 12. notifications – simple notification system
create table notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text,
  is_read boolean default false,
  created_at timestamp with time zone default now()
);

/* ------------------------------------------------
   Row Level Security (RLS) policies
   ------------------------------------------------ */

-- Enable RLS on every table that stores user‑specific data
alter table profiles enable row level security;
alter table sellers enable row level security;
alter table addresses enable row level security;
alter table cart_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table reviews enable row level security;
alter table notifications enable row level security;

-- profiles: users can view/modify only their own profile
create policy "own profile" on profiles for all using (auth.uid() = auth_uid);

-- sellers: only the owner or an admin can see/write
create policy "owner" on sellers for all using (auth.uid() = (select auth_uid from profiles where id = profile_id));
create policy "admin" on sellers for all using (auth.role() = 'admin');

-- addresses: only owner can manage
create policy "owner" on addresses for all using (auth.uid() = (select auth_uid from profiles where id = profile_id));

-- cart_items: only owner can manage
create policy "owner" on cart_items for all using (auth.uid() = (select auth_uid from profiles where id = profile_id));

-- orders: only owner can read/write; admins can read all
create policy "owner" on orders for all using (auth.uid() = (select auth_uid from profiles where id = profile_id));
create policy "admin read" on orders for select using (auth.role() = 'admin');

-- order_items: same rule as orders (owner of order)
create policy "owner" on order_items for all using (
  auth.uid() = (select auth_uid from profiles where id = (select profile_id from orders where id = order_id))
);
create policy "admin read" on order_items for select using (auth.role() = 'admin');

-- reviews: only owner can insert/update/delete; admins can read all
create policy "owner" on reviews for all using (auth.uid() = (select auth_uid from profiles where id = profile_id));
create policy "admin read" on reviews for select using (auth.role() = 'admin');

-- notifications: only owner can read/write
create policy "owner" on notifications for all using (auth.uid() = (select auth_uid from profiles where id = profile_id));


-- Trigger function to auto‑update the `updated_at` column
create or replace function set_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply the trigger on tables that need an `updated_at` timestamp
create trigger set_timestamp_profiles
  before update on profiles
  for each row execute function set_timestamp();

create trigger set_timestamp_sellers
  before update on sellers
  for each row execute function set_timestamp();

create trigger set_timestamp_categories
  before update on categories
  for each row execute function set_timestamp();

create trigger set_timestamp_products
  before update on products
  for each row execute function set_timestamp();

create trigger set_timestamp_seller_listings
  before update on seller_listings
  for each row execute function set_timestamp();

create trigger set_timestamp_addresses
  before update on addresses
  for each row execute function set_timestamp();

create trigger set_timestamp_cart_items
  before update on cart_items
  for each row execute function set_timestamp();

create trigger set_timestamp_orders
  before update on orders
  for each row execute function set_timestamp();

create trigger set_timestamp_order_items
  before update on order_items
  for each row execute function set_timestamp();
