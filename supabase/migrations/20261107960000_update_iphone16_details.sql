-- Update iPhone 16 Pro Max with comprehensive product details
UPDATE public.products
SET
  brand = 'Apple',
  model_number = 'A3295',
  product_type = 'Smartphone',
  description = 'The Apple iPhone 16 Pro Max features a stunning 6.9-inch Super Retina XDR OLED display with ProMotion 120Hz adaptive refresh rate and Always-On display. Powered by the A18 Pro chip with a 6-core CPU, 6-core GPU, and 16-core Neural Engine — delivering desktop-class performance and advanced on-device AI capabilities for Apple Intelligence.

The pro camera system includes a 48MP Fusion camera with a second-generation quad-pixel sensor, a 48MP Ultra Wide camera, and a 12MP 5x Tetraprism telephoto camera with up to 25x digital zoom. Record 4K 120fps Dolby Vision video, spatial video for Apple Vision Pro, and use the new Camera Control button for quick access to camera features.

Built with Grade 5 Titanium and featuring the thinnest borders ever on an iPhone. The Ceramic Shield front is 2x tougher than any smartphone glass. USB-C with USB 3 speeds, MagSafe wireless charging up to 25W, and all-day battery life with up to 33 hours of video playback.

Available in Desert Titanium, Natural Titanium, White Titanium, and Black Titanium.',
  specifications = '{
    "subcategory": "Flagship smartphones",
    "variant": "256 GB storage",
    "chipset": "Apple A18 Pro (3 nm, 2nd gen)",
    "cpu": "6-core (2 performance + 4 efficiency)",
    "gpu": "Apple 6-core GPU with hardware-accelerated ray tracing",
    "neural_engine": "16-core Neural Engine",
    "display": "6.9-inch Super Retina XDR OLED, 2868 x 1320, 120Hz ProMotion",
    "peak_brightness": "2000 nits (outdoor)",
    "always_on_display": "Yes",
    "dynamic_island": "Yes",
    "rear_camera": "48 MP Fusion (f/1.78, 24mm, sensor-shift OIS) + 48 MP Ultra Wide (f/2.2, 13mm) + 12 MP Telephoto 5x Tetraprism (f/2.8, 120mm)",
    "front_camera": "12 MP TrueDepth (f/1.9), autofocus",
    "video": "4K Dolby Vision at 24/25/30/60/120fps, ProRes, Cinematic mode 4K HDR, Spatial video",
    "camera_control": "Dedicated Camera Control button",
    "ram": "8 GB",
    "storage": "256 GB (NVMe)",
    "battery": "4,685 mAh, up to 33 hours video playback",
    "charging": "USB-C (USB 3, 10 Gb/s), 27W wired, 25W MagSafe, 15W Qi2",
    "os": "iOS 18",
    "apple_intelligence": "Yes — on-device AI for Writing Tools, Image Playground, Genmoji, Visual Intelligence",
    "sim": "Nano-SIM + eSIM (dual eSIM support)",
    "connectivity": "5G (sub-6 GHz + mmWave), Wi-Fi 7, Bluetooth 5.3, UWB chip (U2), NFC, Thread",
    "satellite": "Emergency SOS via satellite, Roadside Assistance via satellite",
    "biometrics": "Face ID (3D face recognition)",
    "water_resistance": "IP68 (6m for 30 min)",
    "material": "Grade 5 Titanium frame, textured matte glass back, Ceramic Shield front (2x tougher)",
    "dimensions": "163.0 x 77.6 x 8.25 mm",
    "weight": "227 g",
    "colors": "Desert Titanium, Natural Titanium, White Titanium, Black Titanium",
    "action_button": "Yes — customizable Action button",
    "in_the_box": "iPhone 16 Pro Max, USB-C cable (1m), documentation",
    "warranty": "1 year manufacturer warranty",
    "reference_price_basis": "India launch MRP for the 256 GB variant; not a current seller offer"
  }'::jsonb,
  tags = ARRAY['apple', 'iphone', 'iphone-16-pro-max', 'smartphone', 'flagship', '5g', 'titanium', 'a18-pro', 'pro-camera', '256gb', 'apple-intelligence'],
  catalog_reference_price = 134900,
  is_catalog_seed = true,
  updated_at = NOW()
WHERE name ILIKE '%iPhone 16 Pro Max%';

-- Also add a product image if one doesn't exist yet
INSERT INTO public.product_images (
  product_id,
  storage_path,
  alt_text,
  is_representative,
  "order"
)
SELECT
  p.id,
  'https://images.unsplash.com/photo-1727447238503-803e92a093c8?w=800&h=800&fit=crop',
  'Apple iPhone 16 Pro Max in Natural Titanium',
  true,
  0
FROM public.products p
WHERE p.name ILIKE '%iPhone 16 Pro Max%'
AND NOT EXISTS (
  SELECT 1 FROM public.product_images pi WHERE pi.product_id = p.id
);
