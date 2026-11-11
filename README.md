# Shopora — Modern Multi-Vendor Ecommerce Marketplace

A modern, high-performance multi-vendor ecommerce web application inspired by the customer experience of Blinkit and Amazon, built with Next.js (App Router), Tailwind CSS, and Supabase.

---

## Architecture & Core Features

### 🛒 Customer Storefront
- **Public Ecommerce Landing Page (`/`)**: Responsive marketplace hero, categories and featured products loaded from Supabase, and INR (`₹`) pricing.
- **Top Navigation (`Navbar`)**: Saved location preference, searchable catalog with category selection, live cart count, and role-aware account dropdown.
- **Product Catalog (`/products`)**: Search and filter by real catalog categories, sort by price or name, and receive Supabase Realtime updates.
- **Product Details Page (`/products/[id]`)**: Product image gallery, real availability, multi-seller offers, and Buy Now checkout routing.
- **Persistent Cart (`/cart`)**: Client-side `localStorage` persistence across page reloads with inline Blinkit-style `+ / −` quantity controls.
- **Checkout & Real Order Placement (`/checkout`)**: Authenticated checkout guard, shipping address management (saved to Supabase `addresses`), and order submission writing to `orders` and `order_items` tables.
- **Customer Account Hub (`/dashboard`)**: Full order history tracking with line items, order status badges, and address book.

### 🏪 Seller Central (`/seller/dashboard`)
- **Seller Registration (`/seller/register`)**: Business details, GSTIN, city/state/PIN, category selection, and phone verification.
- **Merchant Dashboard**: Amazon Seller Central inspired interface with metrics (active listings, units in stock, partner health).
- **Inventory Management**: Interactive listings table with quick inline stock increment/decrement.
- **Create Products from Scratch**: Sellers can publish new products (name, brand, category, description, price, stock, and image upload) into the marketplace catalog.
- **List Existing Catalog Products**: Set competitive prices and stock for approved marketplace items.

### 🛡️ Admin Operations Console (`/admin/dashboard` & `/admin/products`)
- **Platform Analytics**: Gross platform sales (GMV), total completed orders, registered merchant count, and pending application count.
- **1-Click Seller Moderation**: Approve or reject merchant onboarding applications with full business credential inspection.
- **Product Catalog Moderation (`/admin/products`)**: Add, edit, approve, and upload high-resolution images to the Supabase `product-images` storage bucket.

---

## Routes

| Route | Audience | Purpose |
| --- | --- | --- |
| `/` | Public | Shopora storefront with a hero, live categories, and featured catalog products |
| `/products` | Public | Full marketplace product catalog with search, filters, and sorting |
| `/products/[id]` | Public | Comprehensive product details page with multi-seller comparison & Buy Now |
| `/cart` | Public | Shopping cart with `localStorage` persistence and quantity adjustments |
| `/checkout` | Customer | Order summary, shipping address selector, and database order placement |
| `/dashboard` | Customer | Customer account, order history, and saved address book |
| `/auth/login` | Public | Role-based authentication supporting `?redirect=` target queries |
| `/auth/register` | Public | Customer account registration |
| `/seller/register` | Customer | Professional merchant onboarding with GSTIN and business credentials |
| `/seller/dashboard` | Seller | Seller Central: inventory management, product creation, and stock updates |
| `/admin/dashboard` | Admin | Operations console: platform GMV analytics and seller approval queue |
| `/admin/products` | Admin | Catalog administration, product moderation, and image uploads |

---

## Local Development Setup

1. **Install dependencies**:
   ```powershell
   npm install
   ```

2. **Configure environment variables**:
   Ensure `.env.local` is present in the project root with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   ```

3. **Start the development server**:
   ```powershell
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Applying Supabase migrations

After linking the project to Supabase, apply pending migrations with:

```powershell
supabase db push
```

The storefront access migration grants authenticated users profile `SELECT`
permission while keeping profile rows restricted by the existing row-level
security policies. It also enables public read access to category names for
storefront navigation. The public seller-offer migration permits reading only
seller IDs, business names, and business types when the seller has an active
offer on an approved product.

The catalog reference migration adds catalog provenance and image attribution
fields, inserts the supported marketplace categories, and seeds curated product
records only where a model-matching, reusable Commons image was verified. Seed
records are marked as Shopora catalog items and do not create seller identities,
inventory, or offers. Their reference prices are informational only; cart and
checkout continue to require an active seller offer. Image credits and licenses
are shown on product detail pages. Apply the migration with `supabase db push`.

The initial verified seed contains 13 products across the categories with
product-matching photographs. Categories without a verified product image are
created for navigation but intentionally have no seeded products yet; no
unrelated photo is presented as an exact product image. Unverified prices,
ratings, discounts, and stock are omitted.
Older seeded items without a verified model-matching photo use the neutral
missing-image fallback rather than an illustration.

---

## Provisioning Administrator Credentials

To grant administrator permissions to an account:
1. Register an account at `/auth/register` or `/auth/login`.
2. Open the Supabase SQL Editor and execute:
   ```sql
   UPDATE public.profiles
   SET role = 'admin'
   WHERE email = 'your-email@example.com';
   ```
3. Sign in to access `/admin/dashboard`.
