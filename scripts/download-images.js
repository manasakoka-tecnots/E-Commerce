const https = require('https');
const fs = require('fs');
const path = require('path');

const SB_URL = 'https://vsbwrxcarifuwrutybsn.supabase.co';
const SB_KEY = 'sb_publishable_sB805Wgphlob5XBtdGra5w_UrMQjCTg';
const IMG_DIR = path.join(__dirname, '..', 'public', 'catalog');

// Product name -> Unsplash image URL mapping
// Using direct Unsplash photo URLs (400x400 for product cards)
const imageMap = {
  // Batch 1 - Electronics
  'iPhone 15 Pro Max 256GB': 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=400&h=400&fit=crop',
  'OnePlus 12 5G 256GB': 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=400&h=400&fit=crop',
  'Redmi Note 13 Pro+ 5G': 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=400&fit=crop',
  'MacBook Air M3 15-inch': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=400&fit=crop',
  'ASUS ROG Strix G16 Gaming Laptop': 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=400&h=400&fit=crop',
  'Lenovo IdeaPad Slim 3 15': 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=400&h=400&fit=crop',
  // Batch 2 - Fashion
  "Levi's 511 Slim Fit Jeans": 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=400&fit=crop',
  'Allen Solly Formal Blazer': 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=400&fit=crop',
  'US Polo Assn Polo T-Shirt': 'https://images.unsplash.com/photo-1625910513413-5fc69d80b91a?w=400&h=400&fit=crop',
  'Libas Anarkali Kurta Set': 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&h=400&fit=crop',
  'Zara Floral Maxi Dress': 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400&h=400&fit=crop',
  'H&M Oversized Hoodie Women': 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop',
  'Kids Cartoon Print T-Shirt Pack of 3': 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=400&h=400&fit=crop',

  // Footwear
  'Nike Air Max 270 React': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop',
  'Woodland Genuine Leather Boots': 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=400&h=400&fit=crop',
  'Bata Formal Oxford Shoes': 'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=400&h=400&fit=crop',

  // Home & Kitchen
  'Prestige Iris 750W Mixer Grinder': 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=400&h=400&fit=crop',
  'Pigeon Favourite 3 Burner Gas Stove': 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop',
  'Philips Daily Collection Air Fryer': 'https://images.unsplash.com/photo-1648649250174-24c8f4a4bc92?w=400&h=400&fit=crop',
  'Borosil 5L Casserole with Lid': 'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=400&h=400&fit=crop',

  // Furniture
  'Wakefit Orthopedic Memory Foam Mattress': 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&h=400&fit=crop',
  'Amazon Basics Ergonomic Office Chair': 'https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=400&h=400&fit=crop',

  // Beauty
  'Maybelline Fit Me Foundation': 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=400&fit=crop',
  'Lakme 9 to 5 Lipstick': 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=400&h=400&fit=crop',
  'Biotique Bio Green Apple Shampoo 400ml': 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=400&h=400&fit=crop',

  // Sports
  'Yonex Nanoray Light 18i Badminton Racket': 'https://images.unsplash.com/photo-1617083934555-ac7d4a2b8135?w=400&h=400&fit=crop',
  'Nivia Storm Football Size 5': 'https://images.unsplash.com/photo-1614632537197-38a17061c2bd?w=400&h=400&fit=crop',
  'Boldfit Yoga Mat 6mm': 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=400&h=400&fit=crop',

  // Books
  'Atomic Habits by James Clear': 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=400&fit=crop',
  'Rich Dad Poor Dad': 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=400&fit=crop',

  // Toys
  'LEGO Classic Creative Bricks 10692': 'https://images.unsplash.com/photo-1587654780291-39c9404d7dd0?w=400&h=400&fit=crop',
  'Funskool Monopoly Board Game': 'https://images.unsplash.com/photo-1611371805429-8b5c1b2c34ba?w=400&h=400&fit=crop',

  // Grocery
  'Tata Sampann Chana Dal 1kg': 'https://images.pexels.com/photos/14965274/pexels-photo-14965274.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
  'Saffola Gold Cooking Oil 5L': 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&h=400&fit=crop',
  'India Gate Basmati Rice Super 5kg': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=400&fit=crop',

  // Health
  'Dabur Chyawanprash 1kg': 'https://images.pexels.com/photos/3273989/pexels-photo-3273989.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
  'Ensure Diabetes Care Vanilla 400g': 'https://images.pexels.com/photos/4480158/pexels-photo-4480158.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',

  // Cables
  'Anker PowerLine III USB-C Cable 1.8m': 'https://images.pexels.com/photos/1694830/pexels-photo-1694830.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
  'Samsung 25W Super Fast Charger': 'https://images.pexels.com/photos/4097206/pexels-photo-4097206.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',

  // Automotive
  'Amaron Pro 12V Car Battery': 'https://images.pexels.com/photos/4374843/pexels-photo-4374843.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
  '3M Car Dashboard Polish 400ml': 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?w=400&h=400&fit=crop',

  // Pet
  'Pedigree Adult Dry Dog Food Chicken 10kg': 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=400&h=400&fit=crop',
  'Whiskas Adult Cat Food Tuna 3kg': 'https://images.pexels.com/photos/1056251/pexels-photo-1056251.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
};

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (u, redirects = 0) => {
      if (redirects > 5) return reject(new Error('Too many redirects'));
      const protocol = u.startsWith('https') ? https : require('http');
      protocol.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return follow(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        file.on('error', (e) => { fs.unlink(dest, () => {}); reject(e); });
      }).on('error', reject);
    };
    follow(url);
  });
}

function postJSON(path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const url = new URL(SB_URL + path);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch(e) { resolve(Buffer.concat(chunks).toString()); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getJSON(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(SB_URL + path);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
      },
    };
    const req = https.request(options, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch(e) { resolve(Buffer.concat(chunks).toString()); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Get all products that don't have images yet
  const products = await getJSON('/rest/v1/products?select=id,name&status=eq.approved&order=created_at.desc');
  if (!Array.isArray(products)) {
    console.log('Error fetching products:', products);
    return;
  }

  // Get existing images
  const existingImages = await getJSON('/rest/v1/product_images?select=product_id');
  const productsWithImages = new Set(
    Array.isArray(existingImages) ? existingImages.map(i => i.product_id) : []
  );

  const productsNeedingImages = products.filter(p => !productsWithImages.has(p.id) && imageMap[p.name]);
  console.log(`Found ${productsNeedingImages.length} products needing images`);

  if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

  const imageRecords = [];

  for (const product of productsNeedingImages) {
    const url = imageMap[product.name];
    if (!url) continue;

    const filename = product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') + '.jpg';
    const filepath = path.join(IMG_DIR, filename);
    const storagePath = `/catalog/${filename}`;

    try {
      if (!fs.existsSync(filepath)) {
        await downloadFile(url, filepath);
        console.log(`  Downloaded: ${filename}`);
      } else {
        console.log(`  Exists: ${filename}`);
      }

      imageRecords.push({
        product_id: product.id,
        storage_path: storagePath,
        alt_text: product.name,
        order: 0,
        is_representative: true,
      });
    } catch (err) {
      console.log(`  FAILED: ${product.name} - ${err.message}`);
    }

    // Small delay to not hit rate limits
    await new Promise(r => setTimeout(r, 200));
  }

  if (imageRecords.length > 0) {
    console.log(`\nInserting ${imageRecords.length} image records...`);
    for (let i = 0; i < imageRecords.length; i += 10) {
      const batch = imageRecords.slice(i, i + 10);
      const result = await postJSON('/rest/v1/product_images', batch);
      if (Array.isArray(result)) {
        result.forEach(r => console.log(`  + Image for ${r.product_id}`));
      } else {
        console.log('  ERROR:', JSON.stringify(result));
      }
    }
  }

  console.log('\nDone!');
}

main().catch(console.error);
