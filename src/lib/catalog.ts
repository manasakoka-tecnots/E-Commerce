import { supabase } from "@/src/lib/supabase/client";

export type ProductCardData = {
  id: string;
  name: string;
  brand: string | null;
  description: string | null;
  categoryId: string | null;
  category: string | null;
  price: number | null;
  referencePrice: number | null;
  isCatalogSeed: boolean;
  imageStoragePath: string | null;
  imageAlt: string | null;
  imageIsRepresentative: boolean;
  inStock: boolean;
  listingDataAvailable: boolean;
  sellerListingId: string | null;
  createdAt: string | null;
  averageRating?: number;
  reviewCount?: number;
};

type CatalogProductRow = {
  id: string;
  name: string;
  brand: string | null;
  description: string | null;
  category_id: string | null;
  is_catalog_seed: boolean;
  catalog_reference_price: number | string | null;
  created_at: string | null;
  product_images: {
    storage_path: string;
    alt_text: string | null;
    is_representative: boolean;
    order: number | null;
  }[] | null;
};

type CatalogListing = {
  id: string;
  price: number | string;
  stock: number | null;
  status: string | null;
};

export type CatalogCategory = {
  id: string;
  name: string;
  image_url?: string | null;
};

export type CatalogProductsResult = {
  products: ProductCardData[];
  listingError: string | null;
};

function getErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Could not load product listing details.";
}

let _productsCache: { data: CatalogProductsResult; ts: number } | null = null;
const PRODUCTS_CACHE_TTL = 60_000; // 1 minute

export async function fetchCatalogProducts(): Promise<CatalogProductsResult> {
  if (_productsCache && Date.now() - _productsCache.ts < PRODUCTS_CACHE_TTL) {
    return _productsCache.data;
  }
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, brand, description, category_id, is_catalog_seed, catalog_reference_price, created_at, product_images(storage_path, alt_text, is_representative, order)"
    )
    .eq("status", "approved")
    .eq("is_catalog_seed", false)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const catalogProducts = (data ?? []) as CatalogProductRow[];
  const listingsByProduct = new Map<string, CatalogListing[]>();
  let listingError: string | null = null;

  if (catalogProducts.length > 0) {
    const { data: listings, error: listingsError } = await supabase
      .from("seller_listings")
      .select("id, product_id, price, stock, status")
      .in(
        "product_id",
        catalogProducts.map((product) => product.id)
      )
      .eq("status", "active");

    if (listingsError) {
      listingError = getErrorMessage(listingsError);
      console.error("Could not load catalog offers:", listingsError.message);
    } else {
      for (const listing of (listings ?? []) as (CatalogListing & {
        product_id: string;
      })[]) {
        const productListings = listingsByProduct.get(listing.product_id) ?? [];
        productListings.push(listing);
        listingsByProduct.set(listing.product_id, productListings);
      }
    }
  }

  // Fetch review aggregates
  const reviewAggsByProduct = new Map<string, { sum: number; count: number }>();
  if (catalogProducts.length > 0) {
    const { data: reviewAggs } = await supabase
      .from("reviews")
      .select("product_id, rating")
      .in(
        "product_id",
        catalogProducts.map((p) => p.id)
      );
    if (reviewAggs) {
      for (const r of reviewAggs as { product_id: string; rating: number }[]) {
        const agg = reviewAggsByProduct.get(r.product_id) ?? { sum: 0, count: 0 };
        agg.sum += Number(r.rating);
        agg.count += 1;
        reviewAggsByProduct.set(r.product_id, agg);
      }
    }
  }

  const products = catalogProducts
    .filter((product) => {
      // Only show products that have at least one active seller listing
      const activeListings = listingsByProduct.get(product.id) ?? [];
      return activeListings.length > 0;
    })
    .map((product) => {
    const activeListings = listingsByProduct.get(product.id) ?? [];
    const availableListings = activeListings.filter(
      (listing) => Number(listing.stock ?? 0) > 0
    );
    const listingsForPrice = availableListings.length
      ? availableListings
      : activeListings;
    const lowestListing = listingsForPrice.reduce<CatalogListing | null>(
      (lowest, listing) => {
        if (!lowest || Number(listing.price) < Number(lowest.price)) {
          return listing;
        }
        return lowest;
      },
      null
    );
    const image = [...(product.product_images ?? [])].sort(
      (a, b) =>
        Number(b.is_representative) - Number(a.is_representative) ||
        (a.order ?? 0) - (b.order ?? 0)
    )[0];

    return {
      id: product.id,
      name: product.name,
      brand: product.brand,
      description: product.description,
      categoryId: product.category_id,
      price: lowestListing ? Number(lowestListing.price) : null,
      referencePrice:
        product.is_catalog_seed && product.catalog_reference_price !== null
          ? Number(product.catalog_reference_price)
          : null,
      isCatalogSeed: product.is_catalog_seed,
      imageStoragePath: image?.storage_path ?? null,
      imageAlt: image?.alt_text ?? product.name,
      imageIsRepresentative: image?.is_representative ?? false,
      inStock: availableListings.length > 0,
      listingDataAvailable: listingError === null,
      category: null,
      sellerListingId: lowestListing ? (lowestListing as CatalogListing & { id: string }).id : null,
      createdAt: product.created_at ?? null,
      averageRating: reviewAggsByProduct.has(product.id)
        ? reviewAggsByProduct.get(product.id)!.sum / reviewAggsByProduct.get(product.id)!.count
        : undefined,
      reviewCount: reviewAggsByProduct.has(product.id)
        ? reviewAggsByProduct.get(product.id)!.count
        : undefined,
    };
  });

  // Deduplicate by product ID to avoid React duplicate key warnings
  const seen = new Set<string>();
  const uniqueProducts = products.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  const result = { products: uniqueProducts, listingError };
  _productsCache = { data: result, ts: Date.now() };
  return result;
}

/**
 * Fetch products by specific IDs — avoids loading entire catalog.
 */
export async function fetchProductsByIds(
  productIds: string[]
): Promise<ProductCardData[]> {
  if (productIds.length === 0) return [];

  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, brand, description, category_id, is_catalog_seed, catalog_reference_price, created_at, product_images(storage_path, alt_text, is_representative, order)"
    )
    .eq("status", "approved")
    .in("id", productIds);

  if (error) throw error;

  const catalogProducts = (data ?? []) as CatalogProductRow[];
  if (catalogProducts.length === 0) return [];

  const { data: listings } = await supabase
    .from("seller_listings")
    .select("id, product_id, price, stock, status")
    .in("product_id", catalogProducts.map((p) => p.id))
    .eq("status", "active");

  const listingsByProduct = new Map<string, CatalogListing[]>();
  for (const listing of (listings ?? []) as (CatalogListing & { product_id: string })[]) {
    const arr = listingsByProduct.get(listing.product_id) ?? [];
    arr.push(listing);
    listingsByProduct.set(listing.product_id, arr);
  }

  return catalogProducts
    .filter((p) => (listingsByProduct.get(p.id) ?? []).length > 0)
    .map((product) => {
      const activeListings = listingsByProduct.get(product.id) ?? [];
      const availableListings = activeListings.filter((l) => Number(l.stock ?? 0) > 0);
      const listingsForPrice = availableListings.length ? availableListings : activeListings;
      const lowestListing = listingsForPrice.reduce<CatalogListing | null>(
        (lowest, l) => (!lowest || Number(l.price) < Number(lowest.price) ? l : lowest),
        null
      );
      const image = [...(product.product_images ?? [])].sort(
        (a, b) => Number(b.is_representative) - Number(a.is_representative) || (a.order ?? 0) - (b.order ?? 0)
      )[0];

      return {
        id: product.id,
        name: product.name,
        brand: product.brand,
        description: product.description,
        categoryId: product.category_id,
        price: lowestListing ? Number(lowestListing.price) : null,
        referencePrice: product.is_catalog_seed && product.catalog_reference_price !== null ? Number(product.catalog_reference_price) : null,
        isCatalogSeed: product.is_catalog_seed,
        imageStoragePath: image?.storage_path ?? null,
        imageAlt: image?.alt_text ?? product.name,
        imageIsRepresentative: image?.is_representative ?? false,
        inStock: availableListings.length > 0,
        listingDataAvailable: true,
        category: null,
        sellerListingId: lowestListing ? lowestListing.id : null,
        createdAt: product.created_at ?? null,
      };
    });
}

/**
 * Fetch products by brand name — avoids loading entire catalog.
 */
export async function fetchProductsByBrand(
  brandName: string
): Promise<ProductCardData[]> {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, brand, description, category_id, is_catalog_seed, catalog_reference_price, created_at, product_images(storage_path, alt_text, is_representative, order)"
    )
    .eq("status", "approved")
    .eq("is_catalog_seed", false)
    .ilike("brand", brandName);

  if (error) throw error;

  const catalogProducts = (data ?? []) as CatalogProductRow[];
  if (catalogProducts.length === 0) return [];

  const { data: listings } = await supabase
    .from("seller_listings")
    .select("id, product_id, price, stock, status")
    .in("product_id", catalogProducts.map((p) => p.id))
    .eq("status", "active");

  const listingsByProduct = new Map<string, CatalogListing[]>();
  for (const listing of (listings ?? []) as (CatalogListing & { product_id: string })[]) {
    const arr = listingsByProduct.get(listing.product_id) ?? [];
    arr.push(listing);
    listingsByProduct.set(listing.product_id, arr);
  }

  return catalogProducts
    .filter((p) => (listingsByProduct.get(p.id) ?? []).length > 0)
    .map((product) => {
      const activeListings = listingsByProduct.get(product.id) ?? [];
      const availableListings = activeListings.filter((l) => Number(l.stock ?? 0) > 0);
      const listingsForPrice = availableListings.length ? availableListings : activeListings;
      const lowestListing = listingsForPrice.reduce<CatalogListing | null>(
        (lowest, l) => (!lowest || Number(l.price) < Number(lowest.price) ? l : lowest),
        null
      );
      const image = [...(product.product_images ?? [])].sort(
        (a, b) => Number(b.is_representative) - Number(a.is_representative) || (a.order ?? 0) - (b.order ?? 0)
      )[0];

      return {
        id: product.id,
        name: product.name,
        brand: product.brand,
        description: product.description,
        categoryId: product.category_id,
        price: lowestListing ? Number(lowestListing.price) : null,
        referencePrice: product.is_catalog_seed && product.catalog_reference_price !== null ? Number(product.catalog_reference_price) : null,
        isCatalogSeed: product.is_catalog_seed,
        imageStoragePath: image?.storage_path ?? null,
        imageAlt: image?.alt_text ?? product.name,
        imageIsRepresentative: image?.is_representative ?? false,
        inStock: availableListings.length > 0,
        listingDataAvailable: true,
        category: null,
        sellerListingId: lowestListing ? lowestListing.id : null,
        createdAt: product.created_at ?? null,
      };
    });
}

export function attachCategoryNames(
  products: ProductCardData[],
  categories: CatalogCategory[]
): ProductCardData[] {
  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name])
  );
  return products.map((product) => ({
    ...product,
    category: product.categoryId
      ? categoryNames.get(product.categoryId) ?? null
      : null,
  }));
}

let _categoriesCache: { data: CatalogCategory[]; ts: number } | null = null;
const CACHE_TTL = 60_000; // 1 minute

export async function fetchCatalogCategories(): Promise<CatalogCategory[]> {
  if (_categoriesCache && Date.now() - _categoriesCache.ts < CACHE_TTL) {
    return _categoriesCache.data;
  }
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, image_url")
    .order("name");

  if (error) throw error;
  const result = (data ?? []) as CatalogCategory[];
  _categoriesCache = { data: result, ts: Date.now() };
  return result;
}

/**
 * Fetch locally uploaded images and patch products that have no DB image.
 */
export async function patchLocalUploads(
  products: ProductCardData[]
): Promise<ProductCardData[]> {
  try {
    const res = await fetch("/api/product-uploads");
    if (!res.ok) return products;
    const mapping: Record<string, string> = await res.json();
    if (!Object.keys(mapping).length) return products;
    return products.map((p) =>
      !p.imageStoragePath && mapping[p.id]
        ? { ...p, imageStoragePath: mapping[p.id] }
        : p
    );
  } catch {
    return products;
  }
}

export function getProductImageUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  // Local files: catalog images, uploaded images
  if (
    path.startsWith("catalog/") ||
    path.startsWith("/catalog/") ||
    path.startsWith("uploads/") ||
    path.startsWith("/uploads/")
  ) {
    return path.startsWith("/") ? path : `/${path}`;
  }
  return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}
