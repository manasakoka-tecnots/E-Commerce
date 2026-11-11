const https = require('https');

const SB_URL = 'https://vsbwrxcarifuwrutybsn.supabase.co';
const SB_KEY = 'sb_publishable_sB805Wgphlob5XBtdGra5w_UrMQjCTg';
const SELLER_ID = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb003';

const CATS = {
  mobiles: 'a5ab5186-aaa0-413d-aefb-42b05c948cd4',
  laptops: 'a7a28e1f-cb97-4e2e-908c-313a9cedcaa8',
  cables: '24b49375-5056-40c5-9811-71cda929e2ba',
  mens: 'c444a33a-a878-41ed-9f06-7a8f4a7100e8',
  womens: '6ca5c46b-15a3-443d-8594-558c5de1adc6',
  kids: '6d899e47-cf7b-4a02-b711-ee627ceae155',
  footwear: '3d0641f5-53eb-41ee-b0dc-80fb9a8eb819',
  home: 'cbe0ecc4-6fd2-43ab-90dc-85a0949ec529',
  furniture: 'c505f82c-5347-4a73-8fa3-e30550f0b535',
  beauty: '1f51c87d-268c-492d-9e49-3958197f2113',
  grocery: 'cd2d6ef8-9103-497f-8790-65fdfa7f4987',
  health: 'e4de2b15-2354-4276-bd94-8e0d489132c1',
  sports: 'a4af15a2-faae-4eb1-af06-5c4987788725',
  books: '08ff209e-c531-4041-8d09-caca34e34de4',
  toys: 'e01ffb1f-6a3d-4eb7-bf20-7162c788436b',
  auto: '57856324-02f4-42e3-9392-7011f933a4e3',
  pet: 'f80ff4c4-3d30-43c5-8e44-caf56e521fd8',
};

function makeProduct(name, brand, catKey, desc, refPrice, type, tags, dateStr) {
  return {
    name, brand,
    category_id: CATS[catKey],
    description: desc,
    status: 'approved',
    seller_id: SELLER_ID,
    is_catalog_seed: true,
    catalog_reference_price: refPrice,
    product_type: type,
    tags,
    created_at: dateStr,
  };
}

const products = [
  // Fashion
  makeProduct("Levi's 511 Slim Fit Jeans", "Levi's", 'mens', "Levi's 511 Slim Fit Jeans in dark indigo wash. Stretch denim for comfort, classic 5-pocket styling, zip fly.", 2999, 'Jeans', ['levis','jeans','men','denim'], '2026-09-10T10:00:00Z'),
  makeProduct("Allen Solly Formal Blazer", "Allen Solly", 'mens', "Slim fit formal blazer in navy blue. Single-breasted, notch lapel, two-button closure. Perfect for office.", 4999, 'Blazer', ['blazer','formal','men','office'], '2026-08-15T10:00:00Z'),
  makeProduct("US Polo Assn Polo T-Shirt", "US Polo Assn", 'mens', "Classic polo t-shirt with embroidered logo. Cotton pique fabric, ribbed collar and cuffs. Regular fit.", 1299, 'T-Shirt', ['polo','tshirt','men','casual'], '2026-10-05T10:00:00Z'),
  makeProduct("Libas Anarkali Kurta Set", "Libas", 'womens', "Floral printed Anarkali kurta with palazzo pants and dupatta. Viscose rayon fabric, flared silhouette.", 1899, 'Kurta Set', ['kurta','women','ethnic','festive'], '2026-09-25T10:00:00Z'),
  makeProduct("Zara Floral Maxi Dress", "Zara", 'womens', "Flowing floral print maxi dress with V-neckline, adjustable spaghetti straps, tiered skirt. Lightweight viscose.", 3490, 'Dress', ['zara','dress','women','floral'], '2026-10-02T10:00:00Z'),
  makeProduct("H&M Oversized Hoodie Women", "H&M", 'womens', "Relaxed-fit oversized hoodie in cotton blend. Drawstring hood, kangaroo pocket, ribbed cuffs and hem.", 1999, 'Hoodie', ['hoodie','women','casual','winter'], '2026-09-18T10:00:00Z'),
  makeProduct("Kids Cartoon Print T-Shirt Pack of 3", "Max", 'kids', "Pack of 3 cotton t-shirts with fun cartoon prints. Round neck, half sleeves, soft fabric. Ages 4-12.", 799, 'T-Shirt', ['kids','tshirt','cotton','multipack'], '2026-10-18T10:00:00Z'),

  // Footwear
  makeProduct("Nike Air Max 270 React", "Nike", 'footwear', "Nike Air Max 270 React with dual Air Max and React foam cushioning. Breathable mesh upper, rubber outsole.", 13995, 'Running Shoes', ['nike','airmax','sneakers','running'], '2026-08-30T10:00:00Z'),
  makeProduct("Woodland Genuine Leather Boots", "Woodland", 'footwear', "Genuine leather ankle boots with rubber sole, padded collar, metal eyelets. Water-resistant treatment.", 4495, 'Boots', ['woodland','boots','leather','outdoor'], '2026-09-18T10:00:00Z'),
  makeProduct("Bata Formal Oxford Shoes", "Bata", 'footwear', "Classic black Oxford shoes in genuine leather. Lace-up closure, cushioned insole, durable rubber sole.", 2499, 'Formal Shoes', ['bata','formal','shoes','leather'], '2026-10-08T10:00:00Z'),

  // Home & Kitchen
  makeProduct("Prestige Iris 750W Mixer Grinder", "Prestige", 'home', "750W mixer grinder with 3 stainless steel jars, multi-purpose blades, overload protection. 2-year warranty.", 3499, 'Mixer Grinder', ['prestige','mixer','kitchen','appliance'], '2026-08-10T10:00:00Z'),
  makeProduct("Pigeon Favourite 3 Burner Gas Stove", "Pigeon", 'home', "3 burner gas stove with brass burners, toughened glass top, spill-proof design. ISI certified.", 2899, 'Gas Stove', ['pigeon','gas-stove','kitchen','cooking'], '2026-09-28T10:00:00Z'),
  makeProduct("Philips Daily Collection Air Fryer", "Philips", 'home', "Rapid Air technology for 90% less fat. 0.8kg capacity, 1425W, time and temp control, dishwasher safe parts.", 6999, 'Air Fryer', ['philips','airfryer','kitchen','healthy'], '2026-09-15T10:00:00Z'),
  makeProduct("Borosil 5L Casserole with Lid", "Borosil", 'home', "Stainless steel insulated casserole. Keeps food hot for 4+ hours. PUF insulation, sturdy handles.", 1299, 'Casserole', ['borosil','casserole','kitchen','steel'], '2026-10-20T10:00:00Z'),

  // Furniture
  makeProduct("Wakefit Orthopedic Memory Foam Mattress", "Wakefit", 'furniture', "6-inch memory foam mattress. CertiPUR-US certified, zero partner disturbance, removable zipper cover.", 8999, 'Mattress', ['wakefit','mattress','orthopedic','bedroom'], '2026-08-18T10:00:00Z'),
  makeProduct("Amazon Basics Ergonomic Office Chair", "Amazon Basics", 'furniture', "Mesh back office chair with lumbar support. Adjustable height, 360-degree swivel, padded seat. Up to 125kg.", 7999, 'Office Chair', ['chair','office','ergonomic','furniture'], '2026-09-22T10:00:00Z'),

  // Beauty
  makeProduct("Maybelline Fit Me Foundation", "Maybelline", 'beauty', "Matte + Poreless liquid foundation with micro-powders. Oil-free, dermatologist tested, SPF 22.", 549, 'Foundation', ['maybelline','foundation','makeup','beauty'], '2026-10-08T10:00:00Z'),
  makeProduct("Lakme 9 to 5 Lipstick", "Lakme", 'beauty', "Primer + Matte lipstick with built-in primer. Long-lasting color, lightweight formula, 30+ shades.", 450, 'Lipstick', ['lakme','lipstick','makeup','beauty'], '2026-09-12T10:00:00Z'),
  makeProduct("Biotique Bio Green Apple Shampoo 400ml", "Biotique", 'beauty', "Fresh daily purifying shampoo with green apple extract. SLS-free, paraben-free, suitable for all hair types.", 299, 'Shampoo', ['biotique','shampoo','haircare','organic'], '2026-08-25T10:00:00Z'),

  // Sports & Fitness
  makeProduct("Yonex Nanoray Light 18i Badminton Racket", "Yonex", 'sports', "Lightweight isometric head racket. Graphite frame, built-in T-joint, medium flex. Beginner to intermediate.", 2190, 'Badminton Racket', ['yonex','badminton','sports'], '2026-08-28T10:00:00Z'),
  makeProduct("Nivia Storm Football Size 5", "Nivia", 'sports', "Machine stitched training football. Rubberized outer cover, nylon wound carcass. Official size 5.", 699, 'Football', ['nivia','football','sports','outdoor'], '2026-10-15T10:00:00Z'),
  makeProduct("Boldfit Yoga Mat 6mm", "Boldfit", 'sports', "Extra thick 6mm yoga mat with anti-slip texture. NBR foam, lightweight, includes carry strap. 72x24 inches.", 599, 'Yoga Mat', ['yoga','mat','fitness','exercise'], '2026-09-05T10:00:00Z'),

  // Books
  makeProduct("Atomic Habits by James Clear", "Penguin", 'books', "The #1 bestselling self-help book. Framework for building good habits and breaking bad ones.", 499, 'Book', ['book','self-help','bestseller','habits'], '2026-08-05T10:00:00Z'),
  makeProduct("Rich Dad Poor Dad", "Plata Publishing", 'books', "Robert Kiyosaki's #1 personal finance book. What the rich teach their kids about money.", 399, 'Book', ['book','finance','bestseller','money'], '2026-09-15T10:00:00Z'),

  // Toys
  makeProduct("LEGO Classic Creative Bricks 10692", "LEGO", 'toys', "221-piece creative building set with bricks in 29 colors. For ages 4-99. Includes storage box.", 1499, 'Building Blocks', ['lego','toys','kids','creative'], '2026-09-08T10:00:00Z'),
  makeProduct("Funskool Monopoly Board Game", "Funskool", 'toys', "Classic Monopoly board game. Buy, sell and trade properties. 2-8 players, ages 8+. Hours of family fun.", 599, 'Board Game', ['monopoly','boardgame','family','fun'], '2026-10-01T10:00:00Z'),

  // Grocery
  makeProduct("Tata Sampann Chana Dal 1kg", "Tata", 'grocery', "Premium unpolished chana dal. Rich in protein and fibre, sourced from best farms. No artificial colors.", 139, 'Dal', ['tata','grocery','dal','protein'], '2026-10-20T10:00:00Z'),
  makeProduct("Saffola Gold Cooking Oil 5L", "Saffola", 'grocery', "Blended edible vegetable oil with dual seed technology. Rich in oryzanol and MUFA. Heart healthy cooking oil.", 899, 'Cooking Oil', ['saffola','oil','cooking','healthy'], '2026-09-10T10:00:00Z'),
  makeProduct("India Gate Basmati Rice Super 5kg", "India Gate", 'grocery', "Premium aged basmati rice. Long grain, aromatic, fluffy when cooked. Ideal for biryani and pulao.", 599, 'Rice', ['rice','basmati','grocery','staple'], '2026-08-20T10:00:00Z'),

  // Health
  makeProduct("Dabur Chyawanprash 1kg", "Dabur", 'health', "Ayurvedic immunity booster with Amla and 40+ herbs. Clinically tested, 3x immunity. All ages.", 399, 'Health Supplement', ['dabur','ayurvedic','immunity','health'], '2026-09-22T10:00:00Z'),
  makeProduct("Ensure Diabetes Care Vanilla 400g", "Abbott", 'health', "Specialized nutrition for diabetics. Slowly digestible carbs, high protein, 28 vitamins and minerals.", 799, 'Nutrition', ['ensure','diabetes','protein','health'], '2026-10-12T10:00:00Z'),

  // Cables & Chargers
  makeProduct("Anker PowerLine III USB-C Cable 1.8m", "Anker", 'cables', "USB-C to USB-C 60W fast charging cable. 480 Mbps data, braided nylon, 12000+ bend lifespan.", 899, 'USB Cable', ['anker','cable','usb-c','charging'], '2026-10-12T10:00:00Z'),
  makeProduct("Samsung 25W Super Fast Charger", "Samsung", 'cables', "25W USB-C PD3.0 Super Fast Charger. Compatible with Galaxy S24/S23/A-series. Compact design with LED indicator.", 1299, 'Charger', ['samsung','charger','fast-charging','usb-c'], '2026-09-08T10:00:00Z'),

  // Automotive
  makeProduct("Amaron Pro 12V Car Battery", "Amaron", 'auto', "High-performance 12V automotive battery. 55Ah capacity, zero maintenance, high cranking power. 55-month warranty.", 5999, 'Car Battery', ['amaron','battery','car','automotive'], '2026-08-22T10:00:00Z'),
  makeProduct("3M Car Dashboard Polish 400ml", "3M", 'auto', "Professional-grade dashboard polish with UV protection. Leaves a natural matte finish, non-greasy formula.", 399, 'Car Care', ['3m','polish','car','cleaning'], '2026-10-05T10:00:00Z'),

  // Pet Supplies
  makeProduct("Pedigree Adult Dry Dog Food Chicken 10kg", "Pedigree", 'pet', "Complete nutrition for adult dogs. Chicken and vegetables, omega-6 for healthy skin and coat. 10kg bag.", 1499, 'Dog Food', ['pedigree','dog','pet','food'], '2026-09-30T10:00:00Z'),
  makeProduct("Whiskas Adult Cat Food Tuna 3kg", "Whiskas", 'pet', "Complete nutrition for adult cats. Tuna flavor with vitamins and minerals. Supports healthy digestion.", 899, 'Cat Food', ['whiskas','cat','pet','food'], '2026-10-10T10:00:00Z'),
];

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

async function main() {
  console.log(`Inserting ${products.length} products...`);

  // Insert in batches of 10
  const allInserted = [];
  for (let i = 0; i < products.length; i += 10) {
    const batch = products.slice(i, i + 10);
    const result = await postJSON('/rest/v1/products', batch);
    if (Array.isArray(result)) {
      result.forEach(p => {
        console.log(`  + ${p.name} (${p.id})`);
        allInserted.push(p);
      });
    } else {
      console.log(`  ERROR:`, JSON.stringify(result));
    }
  }

  console.log(`\nInserted ${allInserted.length} products. Now creating seller listings...`);

  // Create seller listings with prices (slightly below reference price)
  const listings = allInserted.map(p => ({
    seller_id: SELLER_ID,
    product_id: p.id,
    price: Math.round(p.catalog_reference_price * (0.85 + Math.random() * 0.1)), // 85-95% of reference
    stock: Math.floor(20 + Math.random() * 80), // 20-100 stock
    status: 'active',
    condition: 'new',
  }));

  for (let i = 0; i < listings.length; i += 10) {
    const batch = listings.slice(i, i + 10);
    const result = await postJSON('/rest/v1/seller_listings', batch);
    if (Array.isArray(result)) {
      result.forEach(l => console.log(`  + Listing for product ${l.product_id}: ₹${l.price}, stock ${l.stock}`));
    } else {
      console.log(`  ERROR:`, JSON.stringify(result));
    }
  }

  // Also create listings for the 8 products from batch 1 (already inserted via curl)
  const batch1Ids = [
    { id: 'cefaa1b4-2cf2-456d-9503-5e700f02a1d7', price: 149900, name: 'iPhone 15 Pro Max' },
    { id: 'd4672178-5d50-4f75-aa5c-9e75ec0140a2', price: 59999, name: 'OnePlus 12' },
    { id: '98d6e3c3-d205-4fe6-a9e4-9da6cd51bd33', price: 27499, name: 'Redmi Note 13 Pro+' },
    { id: 'dd2a1173-a2b1-4b7c-bbc6-32e299cb4855', price: 124900, name: 'MacBook Air M3' },
    { id: 'c6ff0807-4c30-46fd-8fd7-6c6985ef6f3a', price: 99990, name: 'ASUS ROG Strix G16' },
    { id: '87921162-432d-4e49-a503-14e89003cc7a', price: 41990, name: 'Lenovo IdeaPad Slim 3' },
    { id: 'be10b6b7-b8b6-4313-8426-24dcfbc148b8', price: 27990, name: 'Sony WH-1000XM5' },
    { id: 'fc649806-65f1-485a-9b29-8d5ffe060586', price: 1099, name: 'boAt Airdopes 141' },
  ];

  const batch1Listings = batch1Ids.map(p => ({
    seller_id: SELLER_ID,
    product_id: p.id,
    price: p.price,
    stock: Math.floor(30 + Math.random() * 70),
    status: 'active',
    condition: 'new',
  }));

  console.log('\nCreating listings for batch 1 products...');
  const b1Result = await postJSON('/rest/v1/seller_listings', batch1Listings);
  if (Array.isArray(b1Result)) {
    b1Result.forEach(l => console.log(`  + Listing: ₹${l.price}, stock ${l.stock}`));
  } else {
    console.log(`  ERROR:`, JSON.stringify(b1Result));
  }

  console.log('\nDone! All products and listings created.');
}

main().catch(console.error);
