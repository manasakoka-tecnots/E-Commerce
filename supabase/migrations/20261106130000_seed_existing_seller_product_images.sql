-- Insert image records for the two existing seller products that have local uploads
-- but no database image records (original Supabase storage upload failed silently)

INSERT INTO public.product_images (product_id, storage_path, alt_text, is_representative, "order")
VALUES
  ('658e81ff-fa6f-46fd-8c35-bbe3d75efce8', 'uploads/658e81ff-fa6f-46fd-8c35-bbe3d75efce8/sweater.jpg', 'Women''s Classic Knit Sweater', true, 0),
  ('85f36cb7-99af-4097-822b-9e6b7e350224', 'uploads/85f36cb7-99af-4097-822b-9e6b7e350224/water-bottle.jpg', 'Stainless Steel Insulated Water Bottle', true, 0)
ON CONFLICT DO NOTHING;
