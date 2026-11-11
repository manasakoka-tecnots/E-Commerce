"use client";

import { type ReactNode, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Pagination, { usePagination } from "@/src/components/Pagination";
import Navbar from "@/src/components/Navbar";
import ProductCard from "@/src/components/ProductCard";
import Spinner from "@/src/components/Spinner";
import Footer from "@/src/components/Footer";
import { supabase } from "@/src/lib/supabase/client";
import {
  attachCategoryNames,
  fetchCatalogCategories,
  fetchCatalogProducts,
  patchLocalUploads,
  type CatalogCategory,
  type ProductCardData,
} from "@/src/lib/catalog";

type SortOption = "featured" | "newest" | "price-asc" | "price-desc" | "name";

function getErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "The marketplace catalog could not be loaded.";
}

export default function ProductsContent() {
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("query") || searchParams.get("q") || "";
  const urlCategory = searchParams.get("category") || "";
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [listingError, setListingError] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState({
    source: urlCategory,
    value: urlCategory,
  });
  const [searchDraft, setSearchDraft] = useState({
    source: urlQuery,
    value: urlQuery,
  });
  const selectedCategory =
    categoryDraft.source === urlCategory ? categoryDraft.value : urlCategory;
  const search = searchDraft.source === urlQuery ? searchDraft.value : urlQuery;
  const [sortBy, setSortBy] = useState<SortOption>("featured");
  const [inStockOnly, setInStockOnly] = useState(false);

  // Advanced filter state
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filterClosing, setFilterClosing] = useState(false);
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [brandSearchQuery, setBrandSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PRODUCTS_PER_PAGE = 8;

  // Collapsible filter sections — all expanded by default
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const toggleSection = useCallback((key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // INR formatter
  const formatINR = useCallback(
    (value: number) =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(value),
    []
  );

  // Compute min/max price from all products
  const priceRange = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const p of products) {
      if (p.price !== null && p.price !== undefined) {
        if (p.price < min) min = p.price;
        if (p.price > max) max = p.price;
      }
    }
    if (min === Infinity) return { min: 0, max: 10000 };
    return { min: Math.floor(min), max: Math.ceil(max) };
  }, [products]);

  // Slider values: use state if set, else fall back to computed range
  const sliderMin = priceMin ? parseFloat(priceMin) : priceRange.min;
  const sliderMax = priceMax ? parseFloat(priceMax) : priceRange.max;

  // Product counts per category
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      if (p.category) {
        const key = p.category.toLowerCase();
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }, [products]);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    const categoriesRequest = fetchCatalogCategories()
      .then((catalogCategories) => {
        setCategories(catalogCategories);
        setCategoryError(null);
        return catalogCategories;
      })
      .catch((loadError: unknown) => {
        console.warn("Could not load catalog categories:", loadError);
        setCategories([]);
        setCategoryError(getErrorMessage(loadError));
        return [];
      });
    try {
      const [catalogResult, catalogCategories] = await Promise.all([
        fetchCatalogProducts(),
        categoriesRequest,
      ]);
      const patched = await patchLocalUploads(catalogResult.products);
      setProducts(attachCategoryNames(patched, catalogCategories));
      setListingError(catalogResult.listingError);
    } catch (loadError) {
      setProducts([]);
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const categoriesRequest = fetchCatalogCategories()
      .then((catalogCategories) => {
        if (!active) return;
        setCategories(catalogCategories);
        setCategoryError(null);
        return catalogCategories;
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        console.warn("Could not load catalog categories:", loadError);
        setCategories([]);
        setCategoryError(getErrorMessage(loadError));
        return [];
      });

    Promise.all([fetchCatalogProducts(), categoriesRequest])
      .then(async ([catalogResult, catalogCategories]) => {
        if (!active) return;
        const patched = await patchLocalUploads(catalogResult.products);
        if (!active) return;
        setProducts(attachCategoryNames(patched, catalogCategories ?? []));
        setListingError(catalogResult.listingError);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setProducts([]);
        setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => void loadCatalog(), 2000);
    };

    const channel = supabase
      .channel("storefront-catalog")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        debouncedReload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "seller_listings" },
        debouncedReload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categories" },
        debouncedReload
      )
      .subscribe();

    return () => {
      active = false;
      if (reloadTimer) clearTimeout(reloadTimer);
      void supabase.removeChannel(channel);
    };
  }, [loadCatalog]);

  // Extract unique brands from all products, sorted by frequency
  const allBrands = useMemo(() => {
    const brandCounts = new Map<string, number>();
    for (const p of products) {
      if (p.brand) {
        brandCounts.set(p.brand, (brandCounts.get(p.brand) ?? 0) + 1);
      }
    }
    return Array.from(brandCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [products]);

  const visibleBrands = (showAllBrands ? allBrands : allBrands.slice(0, 8)).filter(
    (b) => !brandSearchQuery || b.name.toLowerCase().includes(brandSearchQuery.toLowerCase())
  );

  // Count active filters for the badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (priceMin) count++;
    if (priceMax) count++;
    if (selectedBrands.size > 0) count++;
    if (onSaleOnly) count++;
    if (minRating > 0) count++;
    if (search) count++;
    if (selectedCategory) count++;
    if (inStockOnly) count++;
    return count;
  }, [priceMin, priceMax, selectedBrands, onSaleOnly, minRating, search, selectedCategory, inStockOnly]);

  const toggleBrand = useCallback((brand: string) => {
    setSelectedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brand)) next.delete(brand);
      else next.add(brand);
      return next;
    });
  }, []);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const pMin = priceMin ? parseFloat(priceMin) : null;
    const pMax = priceMax ? parseFloat(priceMax) : null;
    return products
      .filter((product) => {
        const matchesSearch =
          !query ||
          product.name.toLowerCase().includes(query) ||
          product.brand?.toLowerCase().includes(query) ||
          product.description?.toLowerCase().includes(query);
        const matchesCategory =
          !selectedCategory ||
          product.category?.toLowerCase() === selectedCategory.toLowerCase();
        const matchesStock = !inStockOnly || product.inStock;
        const matchesPriceMin =
          pMin === null || (product.price !== null && product.price >= pMin);
        const matchesPriceMax =
          pMax === null || (product.price !== null && product.price <= pMax);
        const matchesBrand =
          selectedBrands.size === 0 ||
          (product.brand !== null && selectedBrands.has(product.brand));
        const matchesOnSale =
          !onSaleOnly ||
          (product.referencePrice !== null &&
            product.price !== null &&
            product.referencePrice > product.price);
        const matchesRating =
          minRating === 0 ||
          ((product as ProductCardData & { averageRating?: number })
            .averageRating ?? 0) >= minRating;
        return (
          matchesSearch &&
          matchesCategory &&
          matchesStock &&
          matchesPriceMin &&
          matchesPriceMax &&
          matchesBrand &&
          matchesOnSale &&
          matchesRating
        );
      })
      .sort((first, second) => {
        if (sortBy === "price-asc") {
          const a = first.price ?? Number.MAX_SAFE_INTEGER;
          const b = second.price ?? Number.MAX_SAFE_INTEGER;
          return a - b;
        }
        if (sortBy === "price-desc") {
          const a = first.price ?? 0;
          const b = second.price ?? 0;
          return b - a;
        }
        if (sortBy === "newest") {
          const a = first.createdAt ? new Date(first.createdAt).getTime() : 0;
          const b = second.createdAt ? new Date(second.createdAt).getTime() : 0;
          return b - a;
        }
        if (sortBy === "name") return first.name.localeCompare(second.name);
        // "featured" — in-stock first, then newest
        if (first.inStock !== second.inStock) return first.inStock ? -1 : 1;
        const a = first.createdAt ? new Date(first.createdAt).getTime() : 0;
        const b = second.createdAt ? new Date(second.createdAt).getTime() : 0;
        return b - a;
      });
  }, [products, search, selectedCategory, inStockOnly, sortBy, priceMin, priceMax, selectedBrands, onSaleOnly, minRating]);

  // Reset to first page whenever any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory, inStockOnly, sortBy, priceMin, priceMax, selectedBrands, onSaleOnly, minRating]);

  const paginatedProducts = usePagination(filteredProducts, currentPage, PRODUCTS_PER_PAGE);

  const clearFilters = () => {
    setSearchDraft({ source: urlQuery, value: "" });
    setCategoryDraft({ source: urlCategory, value: "" });
    setInStockOnly(false);
    setPriceMin("");
    setPriceMax("");
    setSelectedBrands(new Set());
    setOnSaleOnly(false);
    setMinRating(0);
  };

  const hasAnyFilter =
    search || selectedCategory || inStockOnly || priceMin || priceMax || selectedBrands.size > 0 || onSaleOnly || minRating > 0;

  const closeFilterPanel = useCallback(() => {
    setFilterClosing(true);
    setTimeout(() => {
      setShowFilters(false);
      setFilterClosing(false);
    }, 250);
  }, []);

  /* ── Collapsible section helper ── */
  const FilterSection = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => {
    const isCollapsed = !!collapsedSections[id];
    return (
      <fieldset className="border-b border-slate-100 pb-4 last:border-0">
        <button
          type="button"
          onClick={() => toggleSection(id)}
          className="flex w-full items-center justify-between py-1"
          aria-expanded={!isCollapsed}
        >
          <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {title}
          </legend>
          <svg
            aria-hidden="true"
            className={`filter-chevron h-4 w-4 text-slate-400 ${isCollapsed ? "" : "rotated"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div
          className={`filter-section-body ${isCollapsed ? "collapsed" : "expanded"}`}
          style={{ maxHeight: isCollapsed ? 0 : 500 }}
        >
          <div className="pt-2">{children}</div>
        </div>
      </fieldset>
    );
  };

  /* ── Filter sidebar content (shared between desktop sidebar & mobile panel) — Myntra/Flipkart style ── */
  const filterPanelContent = (
    <div className="divide-y divide-slate-100">
      {/* Categories */}
      <FilterSection id="categories" title="Categories">
        <ul className="space-y-0.5">
          <li>
            <label className="flex cursor-pointer items-center gap-2.5 rounded py-1.5 text-sm transition hover:bg-slate-50">
              <input
                type="radio"
                name="filter-category"
                checked={!selectedCategory}
                onChange={() => setCategoryDraft({ source: urlCategory, value: "" })}
                className="h-4 w-4 accent-[#ff3f6c]"
              />
              <span className={`flex-1 ${!selectedCategory ? "font-semibold text-slate-900" : "text-slate-600"}`}>All Categories</span>
              <span className="text-xs text-slate-400">{products.length}</span>
            </label>
          </li>
          {categories.map((category) => {
            const count = categoryCounts.get(category.name.toLowerCase()) ?? 0;
            const isActive = selectedCategory.toLowerCase() === category.name.toLowerCase();
            return (
              <li key={category.id}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded py-1.5 text-sm transition hover:bg-slate-50">
                  <input
                    type="radio"
                    name="filter-category"
                    checked={isActive}
                    onChange={() => setCategoryDraft({ source: urlCategory, value: category.name })}
                    className="h-4 w-4 accent-[#ff3f6c]"
                  />
                  <span className={`flex-1 ${isActive ? "font-semibold text-slate-900" : "text-slate-600"}`}>{category.name}</span>
                  <span className="text-xs text-slate-400">{count}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </FilterSection>

      {/* Brand Filter */}
      {allBrands.length > 0 && (
        <FilterSection id="brand" title="Brand">
          <div className="mb-2">
            <input
              type="text"
              placeholder="Search brand"
              className="w-full rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#ff3f6c] focus:ring-1 focus:ring-[#ff3f6c]/20"
              value={brandSearchQuery}
              onChange={(e) => {
                const q = e.target.value;
                setBrandSearchQuery(q);
                if (q) {
                  setShowAllBrands(true);
                }
              }}
            />
          </div>
          <ul className="max-h-52 space-y-0.5 overflow-y-auto">
            {visibleBrands.map((brand) => (
              <li key={brand.name}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded py-1.5 text-sm transition hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selectedBrands.has(brand.name)}
                    onChange={() => toggleBrand(brand.name)}
                    className="h-4 w-4 rounded border-slate-300 accent-[#ff3f6c]"
                  />
                  <span className={`flex-1 truncate ${selectedBrands.has(brand.name) ? "font-semibold text-slate-900" : "text-slate-600"}`}>
                    {brand.name}
                  </span>
                  <span className="text-xs text-slate-400">{brand.count}</span>
                </label>
              </li>
            ))}
          </ul>
          {allBrands.length > 8 && (
            <button
              type="button"
              onClick={() => setShowAllBrands((v) => !v)}
              className="mt-2 text-xs font-semibold text-[#ff3f6c] hover:underline"
            >
              + {showAllBrands ? "Show less" : `${allBrands.length - 8} more`}
            </button>
          )}
        </FilterSection>
      )}

      {/* Price Range */}
      <FilterSection id="price" title="Price">
        <ul className="space-y-0.5">
          {[
            { label: "Under \u20B9500", min: "", max: "500" },
            { label: "\u20B9500 - \u20B91,000", min: "500", max: "1000" },
            { label: "\u20B91,000 - \u20B92,000", min: "1000", max: "2000" },
            { label: "\u20B92,000 - \u20B95,000", min: "2000", max: "5000" },
            { label: "Above \u20B95,000", min: "5000", max: "" },
          ].map((range) => {
            const isActive = priceMin === range.min && priceMax === range.max;
            return (
              <li key={range.label}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded py-1.5 text-sm transition hover:bg-slate-50">
                  <input
                    type="radio"
                    name="filter-price"
                    checked={isActive}
                    onChange={() => { setPriceMin(range.min); setPriceMax(range.max); }}
                    className="h-4 w-4 accent-[#ff3f6c]"
                  />
                  <span className={`flex-1 ${isActive ? "font-semibold text-slate-900" : "text-slate-600"}`}>{range.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
        {(priceMin || priceMax) && (
          <button
            type="button"
            onClick={() => { setPriceMin(""); setPriceMax(""); }}
            className="mt-2 text-xs font-semibold text-[#ff3f6c] hover:underline"
          >
            Clear price filter
          </button>
        )}
      </FilterSection>

      {/* Customer Ratings */}
      <FilterSection id="rating" title="Customer Ratings">
        <ul className="space-y-1">
          {[4, 3, 2].map((rating) => (
            <li key={rating}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded py-1.5 text-sm transition hover:bg-slate-50">
                <input
                  type="radio"
                  name="filter-rating"
                  checked={minRating === rating}
                  onChange={() => setMinRating(rating)}
                  className="h-4 w-4 accent-[#ff3f6c]"
                />
                <span className="flex items-center gap-1">
                  <span className={`${minRating === rating ? "font-semibold text-slate-900" : "text-slate-600"}`}>
                    {rating}
                  </span>
                  <span className="text-amber-400">&#9733;</span>
                  <span className={`${minRating === rating ? "font-semibold text-slate-900" : "text-slate-600"}`}>
                    & above
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {minRating > 0 && (
          <button
            type="button"
            onClick={() => setMinRating(0)}
            className="mt-2 text-xs font-semibold text-[#ff3f6c] hover:underline"
          >
            Clear rating filter
          </button>
        )}
      </FilterSection>

      {/* Availability & Deals */}
      <FilterSection id="deals" title="Offers & Availability">
        <ul className="space-y-1">
          <li>
            <label className="flex cursor-pointer items-center gap-2.5 rounded py-1.5 text-sm transition hover:bg-slate-50">
              <input
                type="checkbox"
                checked={onSaleOnly}
                onChange={(e) => setOnSaleOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-[#ff3f6c]"
              />
              <span className={`flex-1 ${onSaleOnly ? "font-semibold text-slate-900" : "text-slate-600"}`}>
                Discount / On Sale
              </span>
            </label>
          </li>
          <li>
            <label className="flex cursor-pointer items-center gap-2.5 rounded py-1.5 text-sm transition hover:bg-slate-50">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-[#ff3f6c]"
              />
              <span className={`flex-1 ${inStockOnly ? "font-semibold text-slate-900" : "text-slate-600"}`}>
                In Stock Only
              </span>
            </label>
          </li>
        </ul>
      </FilterSection>

      {/* Clear all filters */}
      {hasAnyFilter && (
        <div className="px-1 pt-4 pb-2">
          <button
            type="button"
            onClick={clearFilters}
            className="w-full rounded-md border border-[#ff3f6c] bg-white px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-[#ff3f6c] transition hover:bg-[#ff3f6c] hover:text-white"
          >
            Clear all filters
            {activeFilterCount > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff3f6c] px-1 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#faf9f6] text-slate-950">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8 animate-fade-in">
        <div className="rounded-[1.75rem] bg-[#e8eee7] px-6 py-7 sm:px-9 sm:py-10">
          <nav aria-label="Breadcrumb" className="mb-5 text-xs text-slate-600">
            <Link href="/" className="transition hover:text-teal-900">Home</Link>
            <span className="px-2" aria-hidden="true">/</span>
            <span className="font-medium text-slate-900">Products</span>
            {selectedCategory && (
              <>
                <span className="px-2" aria-hidden="true">/</span>
                <span className="font-medium text-teal-900">{selectedCategory}</span>
              </>
            )}
          </nav>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-900">
                The Shopora collection
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Find something worth keeping.
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Browse catalog products and active seller offers. Reference items
                are clearly marked and cannot be purchased without a seller offer.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_190px] lg:w-[470px]">
              <label className="relative block">
                <span className="sr-only">Search products</span>
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <circle cx="11" cy="11" r="7" strokeWidth="1.8" />
                  <path d="m16 16 4 4" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearchDraft({ source: urlQuery, value: event.target.value })
                  }
                  placeholder="Search the catalog"
                  className="w-full rounded-full border border-white bg-white py-3 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-800 focus:ring-2 focus:ring-teal-800/15"
                />
              </label>
              <label>
                <span className="sr-only">Sort products</span>
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as SortOption)}
                  className="w-full cursor-pointer rounded-full border border-white bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-teal-800 focus:ring-2 focus:ring-teal-800/15"
                >
                  <option value="featured">Sort: Featured</option>
                  <option value="newest">Sort: Newest first</option>
                  <option value="price-asc">Price: Low to high</option>
                  <option value="price-desc">Price: High to low</option>
                  <option value="name">Name: A to Z</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="my-7 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCategoryDraft({ source: urlCategory, value: "" })}
              aria-pressed={!selectedCategory}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 ${
                !selectedCategory
                  ? "bg-slate-950 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              All products
              <span className={`ml-1.5 text-[10px] ${!selectedCategory ? "text-white/70" : "text-slate-400"}`}>
                {products.length}
              </span>
            </button>
            {categories.map((category) => {
              const count = categoryCounts.get(category.name.toLowerCase()) ?? 0;
              const isActive = selectedCategory.toLowerCase() === category.name.toLowerCase();
              return (
                <button
                  type="button"
                  key={category.id}
                  onClick={() =>
                    setCategoryDraft({
                      source: urlCategory,
                      value: category.name,
                    })
                  }
                  aria-pressed={isActive}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 ${
                    isActive
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  {category.name}
                  <span className={`ml-1.5 text-[10px] ${isActive ? "text-white/70" : "text-slate-400"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
            </div>
            {categoryError && (
              <p role="status" className="mt-2 text-xs text-amber-800">
                Category filters are unavailable: {categoryError}
                {categoryError.toLowerCase().includes("permission denied") &&
                  " Apply the latest Supabase migration to enable them."}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {/* Mobile filter toggle */}
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="relative flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 lg:hidden"
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2.586a1 1 0 0 1-.293.707l-6.414 6.414a1 1 0 0 0-.293.707V17l-4 4v-6.586a1 1 0 0 0-.293-.707L3.293 7.293A1 1 0 0 1 3 6.586V4z" />
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ff3f6c] text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <p aria-live="polite" className="text-sm text-slate-800">
            {loading ? (
              "Loading products"
            ) : (
              <>
                <span className="font-bold">{selectedCategory || "All Products"}</span>
                <span className="ml-1 text-slate-400">
                  - {filteredProducts.length} item{filteredProducts.length !== 1 ? "s" : ""}
                </span>
              </>
            )}
          </p>
          <div className="flex items-center gap-1 text-xs">
            <span className="mr-1 text-slate-500">Sort by :</span>
            {([
              ["featured", "Recommended"],
              ["newest", "What's New"],
              ["price-asc", "Price: Low to High"],
              ["price-desc", "Price: High to Low"],
            ] as [SortOption, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSortBy(value)}
                className={`rounded-full px-3 py-1.5 font-semibold transition ${
                  sortBy === value
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Active Filter Chips */}
        {hasAnyFilter && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {(priceMin || priceMax) && (
              <span className="filter-chip inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-900 border border-teal-200">
                {priceMin && priceMax
                  ? `${formatINR(parseFloat(priceMin))} - ${formatINR(parseFloat(priceMax))}`
                  : priceMin
                    ? `From ${formatINR(parseFloat(priceMin))}`
                    : `Up to ${formatINR(parseFloat(priceMax))}`}
                <button
                  type="button"
                  onClick={() => { setPriceMin(""); setPriceMax(""); }}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-teal-100 transition"
                  aria-label="Remove price filter"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {Array.from(selectedBrands).map((brand) => (
              <span key={brand} className="filter-chip inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-900 border border-teal-200">
                {brand}
                <button
                  type="button"
                  onClick={() => toggleBrand(brand)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-teal-100 transition"
                  aria-label={`Remove ${brand} filter`}
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
            {minRating > 0 && (
              <span className="filter-chip inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-900 border border-teal-200">
                {minRating}&#9733; &amp; up
                <button
                  type="button"
                  onClick={() => setMinRating(0)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-teal-100 transition"
                  aria-label="Remove rating filter"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {onSaleOnly && (
              <span className="filter-chip inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-900 border border-teal-200">
                On Sale
                <button
                  type="button"
                  onClick={() => setOnSaleOnly(false)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-teal-100 transition"
                  aria-label="Remove on sale filter"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {inStockOnly && (
              <span className="filter-chip inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-900 border border-teal-200">
                In Stock
                <button
                  type="button"
                  onClick={() => setInStockOnly(false)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-teal-100 transition"
                  aria-label="Remove in stock filter"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {selectedCategory && (
              <span className="filter-chip inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-900 border border-teal-200">
                {selectedCategory}
                <button
                  type="button"
                  onClick={() => setCategoryDraft({ source: urlCategory, value: "" })}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-teal-100 transition"
                  aria-label="Remove category filter"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {search && (
              <span className="filter-chip inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-900 border border-teal-200">
                &ldquo;{search}&rdquo;
                <button
                  type="button"
                  onClick={() => setSearchDraft({ source: urlQuery, value: "" })}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-teal-100 transition"
                  aria-label="Remove search filter"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {activeFilterCount > 1 && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {!loading && !error && listingError && (
          <p role="status" className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Products are shown, but live prices and stock could not be loaded.
            Apply the latest Supabase migrations to enable offers.
          </p>
        )}

        {/* Mobile filter panel (slide-in overlay) */}
        {showFilters && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <div
              className={`absolute inset-0 bg-black/40 ${filterClosing ? "filter-backdrop-exit" : "filter-backdrop-enter"}`}
              onClick={closeFilterPanel}
            />
            {/* Panel */}
            <div
              className={`absolute right-0 top-0 h-full w-[85vw] max-w-sm overflow-y-auto bg-white shadow-2xl ${filterClosing ? "filter-panel-exit" : "filter-panel-enter"}`}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">Filters</h2>
                <div className="flex items-center gap-3">
                  {hasAnyFilter && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="text-xs font-bold uppercase text-[#ff3f6c]"
                    >
                      Clear all
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeFilterPanel}
                    className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition"
                    aria-label="Close filters"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="px-4 py-2">
                {filterPanelContent}
              </div>
            </div>
          </div>
        )}

        {/* Desktop: sidebar + grid layout */}
        <div className="flex gap-8">
          {/* Desktop sidebar — Myntra/Flipkart style */}
          <aside className="hidden w-[270px] shrink-0 lg:block">
            <div className="sticky top-24 rounded-none border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">Filters</h2>
                {hasAnyFilter && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs font-bold uppercase text-[#ff3f6c] hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="max-h-[calc(100vh-160px)] overflow-y-auto px-4 py-2">
                {filterPanelContent}
              </div>
            </div>
          </aside>

          {/* Product grid */}
          <div className="min-w-0 flex-1">
            {loading ? (
              <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }, (_, index) => (
                  <div
                    key={index}
                    className="aspect-[3/5] bg-white skeleton-shimmer"
                  />
                ))}
              </div>
            ) : error ? (
              <div
                role="alert"
                className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 p-7 text-center"
              >
                <h2 className="text-lg font-semibold text-rose-950">
                  We couldn&apos;t load the catalog
                </h2>
                <p className="mt-2 text-sm text-rose-800">{error}</p>
                {error.toLowerCase().includes("permission denied") && (
                  <p className="mt-2 text-sm text-rose-800">
                    Apply the latest Supabase migration to update catalog access.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void loadCatalog()}
                  className="mt-5 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
                >
                  Try again
                </button>
              </div>
            ) : filteredProducts.length ? (
              <>
                <div className="product-grid-fade grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" key={filteredProducts.length}>
                  {paginatedProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
                <Pagination
                  totalItems={filteredProducts.length}
                  currentPage={currentPage}
                  itemsPerPage={PRODUCTS_PER_PAGE}
                  onPageChange={setCurrentPage}
                />
              </>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
                <h2 className="text-xl font-semibold">No products match just yet</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                  Try a different search or category. The catalog only shows products
                  currently recorded in Shopora.
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
                >
                  Reset filters
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
