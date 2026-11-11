import { supabase } from "@/src/lib/supabase/client";

export type Brand = {
  id?: string;
  name: string;
  slug: string;
  logo_url: string;
  description: string;
  category: string;
};

// Default brands as fallback (also seeded in database)
export const DEFAULT_BRANDS: Brand[] = [
  // Sportswear & Footwear
  { name: "Nike", slug: "nike", logo_url: "/brand-logos/nike.svg", description: "Just Do It — World's leading sportswear and athletic footwear brand.", category: "Sportswear & Footwear" },
  { name: "Adidas", slug: "adidas", logo_url: "/brand-logos/adidas.svg", description: "Impossible Is Nothing — Global sportswear manufacturer known for the iconic three stripes.", category: "Sportswear & Footwear" },
  { name: "Puma", slug: "puma", logo_url: "/brand-logos/puma.svg", description: "Forever Faster — Premium athletic and lifestyle brand for sports enthusiasts.", category: "Sportswear & Footwear" },
  { name: "Under Armour", slug: "under-armour", logo_url: "/brand-logos/under-armour.svg", description: "The Only Way Is Through — Performance apparel, footwear, and accessories.", category: "Sportswear & Footwear" },
  { name: "Reebok", slug: "reebok", logo_url: "/brand-logos/reebok.svg", description: "Life is Not a Spectator Sport — Fitness and lifestyle footwear and apparel.", category: "Sportswear & Footwear" },
  // Clothing & Fashion
  { name: "Zara", slug: "zara", logo_url: "/brand-logos/zara.svg", description: "Fast fashion leader with trendy, affordable clothing for men, women, and kids.", category: "Clothing & Fashion" },
  { name: "H&M", slug: "hm", logo_url: "/brand-logos/hm.svg", description: "Fashion and quality at the best price in a sustainable way.", category: "Clothing & Fashion" },
  { name: "Uniqlo", slug: "uniqlo", logo_url: "/brand-logos/uniqlo.svg", description: "LifeWear — Simple, high-quality everyday clothing for everyone.", category: "Clothing & Fashion" },
  { name: "Levi's", slug: "levis", logo_url: "/brand-logos/levis.svg", description: "Quality Never Goes Out of Style — Iconic denim jeans and casual wear since 1853.", category: "Clothing & Fashion" },
  // Electronics
  { name: "Samsung", slug: "samsung", logo_url: "/brand-logos/samsung.svg", description: "Innovation leader in smartphones, TVs, home appliances, and semiconductors.", category: "Electronics" },
  { name: "Apple", slug: "apple", logo_url: "/brand-logos/apple.svg", description: "Think Different — Premium consumer electronics, software, and services.", category: "Electronics" },
  { name: "Sony", slug: "sony", logo_url: "/brand-logos/sony.svg", description: "Be Moved — Electronics, gaming, entertainment, and professional solutions.", category: "Electronics" },
  { name: "Xiaomi", slug: "xiaomi", logo_url: "/brand-logos/xiaomi.svg", description: "Innovation for Everyone — Smartphones, smart home devices, and electronics at great value.", category: "Electronics" },
  { name: "OnePlus", slug: "oneplus", logo_url: "/brand-logos/oneplus.svg", description: "Never Settle — Premium smartphones and tech accessories.", category: "Electronics" },
  // Computers & Laptops
  { name: "HP", slug: "hp", logo_url: "/brand-logos/hp.svg", description: "Keep Reinventing — Computers, printers, and technology solutions for everyone.", category: "Computers & Laptops" },
  { name: "Dell", slug: "dell", logo_url: "/brand-logos/dell.svg", description: "Technology that drives human progress — PCs, monitors, and enterprise solutions.", category: "Computers & Laptops" },
  { name: "Lenovo", slug: "lenovo", logo_url: "/brand-logos/lenovo.svg", description: "Smarter Technology for All — World's largest PC vendor with ThinkPad and IdeaPad lines.", category: "Computers & Laptops" },
  // Audio
  { name: "JBL", slug: "jbl", logo_url: "/brand-logos/jbl.svg", description: "Dare to Listen — Premium speakers, headphones, and audio equipment.", category: "Audio" },
  { name: "boAt", slug: "boat", logo_url: "/brand-logos/boat.svg", description: "Plug Into Nirvana — India's #1 audio and wearables brand.", category: "Audio" },
  // Home & Kitchen
  { name: "IKEA", slug: "ikea", logo_url: "/brand-logos/ikea.svg", description: "Creating a better everyday life — Affordable furniture, home accessories, and smart solutions.", category: "Home & Kitchen" },
  { name: "Bosch", slug: "bosch", logo_url: "/brand-logos/bosch.svg", description: "Invented for Life — Home appliances, power tools, and smart home solutions.", category: "Home & Kitchen" },
];

// Keep backward compatibility - BRANDS constant for imports that use it
export const BRANDS = DEFAULT_BRANDS;

let _brandsCache: { data: Brand[]; ts: number } | null = null;
const BRANDS_CACHE_TTL = 60_000; // 1 minute

/** Fetch all brands from the database */
export async function fetchBrands(): Promise<Brand[]> {
  if (_brandsCache && Date.now() - _brandsCache.ts < BRANDS_CACHE_TTL) {
    return _brandsCache.data;
  }
  try {
    const { data, error } = await supabase
      .from("brands")
      .select("id, name, slug, logo_url, description, category")
      .order("name");

    if (error) {
      console.warn("fetchBrands error, using defaults:", error.message);
      return DEFAULT_BRANDS;
    }
    if (!data || data.length === 0) {
      return DEFAULT_BRANDS;
    }
    _brandsCache = { data, ts: Date.now() };
    return data;
  } catch (err) {
    console.warn("fetchBrands exception, using defaults:", err);
    return DEFAULT_BRANDS;
  }
}

/** Find a brand by slug from database */
export async function fetchBrandBySlug(slug: string): Promise<Brand | null> {
  const { data, error } = await supabase
    .from("brands")
    .select("id, name, slug, logo_url, description, category")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    // Fallback to default
    return DEFAULT_BRANDS.find((b) => b.slug === slug) ?? null;
  }
  return data;
}

/** Add a new brand (seller-created) */
export async function createBrand(brand: {
  name: string;
  slug: string;
  logo_url?: string;
  description?: string;
  category?: string;
}): Promise<Brand | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error("Failed to create brand: user not authenticated");
    return null;
  }

  // Get profile id
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_uid", user.id)
    .single();

  // Build insert payload — omit created_by if no profile found
  const insertData: Record<string, unknown> = {
    name: brand.name.trim(),
    slug: brand.slug,
    logo_url: brand.logo_url || null,
    description: brand.description || `Products from ${brand.name.trim()}`,
    category: brand.category || "Other",
  };
  if (profile?.id) {
    insertData.created_by = profile.id;
  }

  const { data, error } = await supabase
    .from("brands")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error("Failed to create brand:", error.message, error.details, error.code);
    // If it's a duplicate, try to fetch the existing one
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("brands")
        .select("id, name, slug, logo_url, description, category")
        .eq("slug", brand.slug)
        .single();
      return existing;
    }
    return null;
  }
  return data;
}

/** Get brand names list for autocomplete */
export async function fetchBrandNames(): Promise<string[]> {
  const brands = await fetchBrands();
  return brands.map((b) => b.name);
}

// Legacy sync helpers (kept for backward compat)
export function getBrandBySlug(slug: string): Brand | undefined {
  return DEFAULT_BRANDS.find((b) => b.slug === slug);
}

export function getBrandNames(): string[] {
  return DEFAULT_BRANDS.map((b) => b.name);
}
