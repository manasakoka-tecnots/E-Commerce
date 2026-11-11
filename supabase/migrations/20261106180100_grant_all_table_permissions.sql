-- Grant table-level permissions to authenticated and anon roles.
-- Without GRANTs, RLS policies are not evaluated — PostgreSQL denies at table level first.

-- Tables that authenticated users need full CRUD on (RLS filters per-row access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;

-- Seller-managed tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sellers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_listings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_pages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_payouts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaigns TO authenticated;

-- Read-only for catalog browsing (categories, products, listings) by anon users
GRANT SELECT ON public.categories TO anon;
GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.product_images TO anon;
GRANT SELECT ON public.product_variants TO anon;
GRANT SELECT ON public.seller_listings TO anon;
GRANT SELECT ON public.sellers TO anon;
GRANT SELECT ON public.collections TO anon;
GRANT SELECT ON public.collection_products TO anon;
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT ON public.discounts TO anon;
GRANT SELECT ON public.discount_products TO anon;

-- Authenticated users also need to read categories
GRANT SELECT ON public.categories TO authenticated;
