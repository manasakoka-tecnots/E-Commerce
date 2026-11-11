-- Create the store-assets bucket for seller uploads (collections, store branding, content files)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'store-assets',
  'store-assets',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];

-- Anyone can read store assets (public bucket)
DROP POLICY IF EXISTS "public read store assets" ON storage.objects;
CREATE POLICY "public read store assets"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'store-assets');

-- Approved sellers can upload to their own folder
DROP POLICY IF EXISTS "sellers upload store assets" ON storage.objects;
CREATE POLICY "sellers upload store assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'store-assets'
  AND (
    public.is_marketplace_admin()
    OR (name LIKE 'sellers/' || public.get_seller_id_for_user()::text || '/%')
  )
);

-- Approved sellers can update their own files
DROP POLICY IF EXISTS "sellers update store assets" ON storage.objects;
CREATE POLICY "sellers update store assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'store-assets'
  AND (
    public.is_marketplace_admin()
    OR (name LIKE 'sellers/' || public.get_seller_id_for_user()::text || '/%')
  )
);

-- Approved sellers can delete their own files
DROP POLICY IF EXISTS "sellers delete store assets" ON storage.objects;
CREATE POLICY "sellers delete store assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'store-assets'
  AND (
    public.is_marketplace_admin()
    OR (name LIKE 'sellers/' || public.get_seller_id_for_user()::text || '/%')
  )
);
