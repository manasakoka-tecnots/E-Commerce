INSERT INTO public.categories (name)
VALUES
  ('Audio & Headphones'),
  ('Bluetooth Speakers'),
  ('Cables & Chargers')
ON CONFLICT (name) DO NOTHING;

UPDATE public.products
SET category_id = (
  SELECT id
  FROM public.categories
  WHERE name = 'Audio & Headphones'
)
WHERE id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb004';

UPDATE public.products
SET category_id = (
  SELECT id
  FROM public.categories
  WHERE name = 'Bluetooth Speakers'
)
WHERE id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb005';

UPDATE public.products
SET category_id = (
  SELECT id
  FROM public.categories
  WHERE name = 'Cables & Chargers'
)
WHERE id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb006';
