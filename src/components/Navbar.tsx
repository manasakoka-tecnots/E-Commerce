"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/src/lib/supabase/client";
import { useCart } from "@/src/context/CartContext";
import { useWishlist } from "@/src/context/WishlistContext";
import { fetchCatalogCategories, type CatalogCategory } from "@/src/lib/catalog";
import { fetchBrands, BRANDS, type Brand } from "@/src/lib/brands";

const RECENT_SEARCHES_KEY = "shopora_recent_searches";
const TRENDING_SEARCHES = ["Smartphones", "Laptops", "Headphones", "Watches", "Cameras", "Sneakers"];

const CITIES = [
  { name: "Mumbai", pincode: "400001" },
  { name: "Delhi NCR", pincode: "110001" },
  { name: "Bengaluru", pincode: "560001" },
  { name: "Hyderabad", pincode: "500001" },
  { name: "Chennai", pincode: "600001" },
  { name: "Kolkata", pincode: "700001" },
  { name: "Pune", pincode: "411001" },
  { name: "Ahmedabad", pincode: "380001" },
];

type AccountUser = {
  id: string;
  email?: string;
  user_metadata?: { full_name?: string };
};

const formatRupee = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { totalItems, totalAmount } = useCart();
  const { totalItems: wishlistCount } = useWishlist();
  const [user, setUser] = useState<AccountUser | null>(null);
  const [role, setRole] = useState("customer");
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [allBrands, setAllBrands] = useState<Brand[]>(BRANDS);
  const [selectedPincode, setSelectedPincode] = useState("");
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const megaMenuTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [suggestions, setSuggestions] = useState<
    { type: "product" | "brand" | "category"; name: string; slug: string; image?: string; price?: number }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [focusedSuggestionIndex, setFocusedSuggestionIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const suggestionsCache = useRef<Map<string, typeof suggestions>>(new Map());
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateAccount = (accountUser: AccountUser | null) => {
      setUser(accountUser);
      if (!accountUser) {
        setRole("customer");
        return;
      }

      void supabase
        .from("profiles")
        .select("role")
        .eq("auth_uid", accountUser.id)
        .maybeSingle()
        .then(({ data: profile, error: profileError }) => {
          if (profileError) {
            console.error("Could not load the account role:", profileError.message);
            return;
          }
          if (profile?.role) setRole(profile.role);
        });
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Could not load the current session:", error.message);
        updateAccount(null);
        return;
      }
      updateAccount(data.session?.user ?? null);
    });
    void fetchCatalogCategories()
      .then(setCategories)
      .catch((error: unknown) => {
        console.warn("Could not load marketplace categories:", error);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      updateAccount(session?.user ?? null);
    });

    Promise.resolve().then(() => {
      try {
        setSelectedCity(localStorage.getItem("shopora_city") || "");
        setSelectedPincode(localStorage.getItem("shopora_pincode") || "");
        const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
        if (stored) {
          try { setRecentSearches(JSON.parse(stored)); } catch { /* ignore */ }
        }
      } catch (error) {
        console.warn("Could not load the saved delivery location:", error);
      }
    });

    fetchBrands().then(setAllBrands);

    const handleClickOutside = (event: MouseEvent) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setShowAccountMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      listener.subscription.unsubscribe();
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const fetchSuggestions = useCallback(
    async (term: string) => {
      if (!term.trim()) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      // Check cache first
      const cacheKey = term.toLowerCase().trim();
      const cached = suggestionsCache.current.get(cacheKey);
      if (cached) {
        setSuggestions(cached);
        setShowSuggestions(true);
        return;
      }

      // Abort any in-flight request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const lower = term.toLowerCase();
        const results: typeof suggestions = [];

        // Fetch only seller-listed products (real products, not seed data)
        const { data: listings, error: listErr } = await supabase
          .from("seller_listings")
          .select("product_id, price, products!inner(id, name, status, product_images(storage_path))")
          .eq("products.status", "approved")
          .ilike("products.name", `%${term}%`)
          .limit(5);

        // If this request was aborted, discard results
        if (controller.signal.aborted) return;

        if (listErr) {
          console.error("Search suggestions error:", JSON.stringify(listErr));
        }

        if (listings && listings.length > 0) {
          const seen = new Map<string, (typeof results)[0]>();
          for (const l of listings) {
            const prod = l.products as unknown as { id: string; name: string; status: string; product_images: { storage_path: string }[] };
            if (!prod) continue;
            const existing = seen.get(prod.id);
            const price = Number(l.price);
            if (!existing || (existing.price != null && price < existing.price)) {
              seen.set(prod.id, {
                type: "product",
                name: prod.name,
                slug: `/products/${prod.id}`,
                image: Array.isArray(prod.product_images) && prod.product_images.length > 0 ? prod.product_images[0].storage_path : undefined,
                price,
              });
            }
          }
          for (const item of seen.values()) {
            results.push(item);
          }
        }

        // Match brands locally
        const matchedBrands = allBrands
          .filter((b) => b.name.toLowerCase().includes(lower))
          .slice(0, 3);
        for (const b of matchedBrands) {
          results.push({ type: "brand", name: b.name, slug: `/brands/${b.slug}`, image: b.logo_url });
        }

        // Match categories locally
        const matchedCategories = categories
          .filter((c) => c.name.toLowerCase().includes(lower))
          .slice(0, 3);
        for (const c of matchedCategories) {
          results.push({
            type: "category",
            name: c.name,
            slug: `/products?category=${encodeURIComponent(c.name)}`,
          });
        }

        // Cache the results
        suggestionsCache.current.set(cacheKey, results);
        // Keep cache size bounded
        if (suggestionsCache.current.size > 50) {
          const firstKey = suggestionsCache.current.keys().next().value;
          if (firstKey) suggestionsCache.current.delete(firstKey);
        }

        setSuggestions(results);
        setShowSuggestions(true);
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("Search suggestions fetch failed:", err);
        }
      }
    },
    [allBrands, categories]
  );

  const saveRecentSearch = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 5);
      try { localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try { localStorage.removeItem(RECENT_SEARCHES_KEY); } catch { /* ignore */ }
  }, []);

  const handleSearchInput = (value: string) => {
    setSearch(value);
    setFocusedSuggestionIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSuggestions([]);
      // Show dropdown for recent/trending even when empty
      setShowSuggestions(true);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(value);
    }, 300);
  };

  // Close suggestions on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    setShowSuggestions(false);
    setFocusedSuggestionIndex(-1);
    const term = search.trim();
    if (term) saveRecentSearch(term);
    // If the search term matches a brand name exactly, go to the brand page
    const matchedBrand = allBrands.find(
      (b) => b.name.toLowerCase() === term.toLowerCase()
    );
    if (matchedBrand && !selectedCategory) {
      router.push(`/brands/${matchedBrand.slug}`);
      setShowMobileMenu(false);
      return;
    }
    const params = new URLSearchParams();
    if (term) params.set("query", term);
    if (selectedCategory) params.set("category", selectedCategory);
    const suffix = params.toString();
    router.push(suffix ? `/products?${suffix}` : "/products");
    setShowMobileMenu(false);
  };

  const handleSelectCity = (city: (typeof CITIES)[number]) => {
    setSelectedCity(city.name);
    setSelectedPincode(city.pincode);
    try {
      localStorage.setItem("shopora_city", city.name);
      localStorage.setItem("shopora_pincode", city.pincode);
    } catch (error) {
      console.warn("Could not save the selected delivery location:", error);
    }
    setShowLocationDialog(false);
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Could not sign out:", error.message);
      return;
    }
    setUser(null);
    setRole("customer");
    setShowAccountMenu(false);
    router.push("/");
  };

  const mobileCategoryLinks = (
    <>
      <Link
        href="/products"
        onClick={() => setShowMobileMenu(false)}
        className="shrink-0 rounded-full border border-[#18463e] bg-[#18463e] px-4 py-2 text-xs font-semibold tracking-wide text-white shadow-sm transition hover:border-[#102e2a] hover:bg-[#102e2a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
      >
        All products
      </Link>
      <Link
        href="/collections"
        onClick={() => setShowMobileMenu(false)}
        className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold tracking-wide text-amber-800 shadow-sm transition hover:border-amber-400 hover:bg-amber-100 hover:text-amber-900 hover:shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
      >
        Collections
      </Link>
      <Link
        href="/brands"
        onClick={() => setShowMobileMenu(false)}
        className="shrink-0 rounded-full border border-indigo-300 bg-indigo-50 px-4 py-2 text-xs font-semibold tracking-wide text-indigo-800 shadow-sm transition hover:border-indigo-400 hover:bg-indigo-100 hover:text-indigo-900 hover:shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        Brands
      </Link>
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/products?category=${encodeURIComponent(category.name)}`}
          onClick={() => setShowMobileMenu(false)}
          className="shrink-0 rounded-full border border-[#d8e6df] bg-[#f1f6f3] px-4 py-2 text-xs font-semibold tracking-wide text-[#294a42] shadow-sm transition hover:border-[#b8d2c4] hover:bg-[#e5f0ea] hover:text-[#102e2a] hover:shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        >
          {category.name}
        </Link>
      ))}
    </>
  );

  const handleMegaMenuEnter = (categoryName: string) => {
    if (megaMenuTimeout.current) clearTimeout(megaMenuTimeout.current);
    setHoveredCategory(categoryName);
  };

  const handleMegaMenuLeave = () => {
    megaMenuTimeout.current = setTimeout(() => {
      setHoveredCategory(null);
    }, 200);
  };

  const closeMegaMenu = () => {
    if (megaMenuTimeout.current) clearTimeout(megaMenuTimeout.current);
    setHoveredCategory(null);
  };

  // Group brands by category for mega menu columns
  const brandsByCategory = useMemo(() => {
    const map = new Map<string, Brand[]>();
    for (const b of allBrands) {
      const cat = b.category || "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(b);
    }
    return map;
  }, [allBrands]);

  // Mega menu data: map each category to subcategories (brands in that space) + quick links
  const MEGA_MENU_DATA: Record<string, { title: string; items: { label: string; href: string }[] }[]> = useMemo(() => {
    const data: Record<string, { title: string; items: { label: string; href: string }[] }[]> = {};

    for (const cat of categories) {
      const catName = cat.name;
      // Get brands that match this category
      const matchingBrands = allBrands
        .filter((b) => b.category?.toLowerCase().includes(catName.toLowerCase()) || catName.toLowerCase().includes(b.category?.toLowerCase() || ""))
        .slice(0, 8);

      const columns: { title: string; items: { label: string; href: string }[] }[] = [];

      // Column 1: Browse by type
      columns.push({
        title: `Shop ${catName}`,
        items: [
          { label: `All ${catName}`, href: `/products?category=${encodeURIComponent(catName)}` },
          { label: "New Arrivals", href: `/products?category=${encodeURIComponent(catName)}&sort=newest` },
          { label: "Best Sellers", href: `/products?category=${encodeURIComponent(catName)}&sort=featured` },
          { label: "On Sale", href: `/products?category=${encodeURIComponent(catName)}&onSale=true` },
        ],
      });

      // Column 2: Top Brands for this category
      if (matchingBrands.length > 0) {
        columns.push({
          title: "Top Brands",
          items: matchingBrands.map((b) => ({
            label: b.name,
            href: `/brands/${b.slug}`,
          })),
        });
      }

      // Column 3: Price Ranges
      columns.push({
        title: "Shop by Price",
        items: [
          { label: "Under \u20B9500", href: `/products?category=${encodeURIComponent(catName)}&priceMax=500` },
          { label: "\u20B9500 \u2013 \u20B91,000", href: `/products?category=${encodeURIComponent(catName)}&priceMin=500&priceMax=1000` },
          { label: "\u20B91,000 \u2013 \u20B92,000", href: `/products?category=${encodeURIComponent(catName)}&priceMin=1000&priceMax=2000` },
          { label: "\u20B92,000 \u2013 \u20B95,000", href: `/products?category=${encodeURIComponent(catName)}&priceMin=2000&priceMax=5000` },
          { label: "Above \u20B95,000", href: `/products?category=${encodeURIComponent(catName)}&priceMin=5000` },
        ],
      });

      data[catName] = columns;
    }

    // "All" dropdown — shows all categories + all brand categories + price
    const allColumns: { title: string; items: { label: string; href: string }[] }[] = [];
    allColumns.push({
      title: "Categories",
      items: categories.map((c) => ({
        label: c.name,
        href: `/products?category=${encodeURIComponent(c.name)}`,
      })),
    });

    // Group brands by their category
    for (const [brandCat, brands] of brandsByCategory) {
      allColumns.push({
        title: brandCat,
        items: brands.slice(0, 6).map((b) => ({
          label: b.name,
          href: `/brands/${b.slug}`,
        })),
      });
    }

    data["__all__"] = allColumns;
    return data;
  }, [categories, allBrands, brandsByCategory]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#cbdcd2] bg-white/95 backdrop-blur">
        <div className="relative z-10 mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:gap-5 lg:px-8">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-800"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#102e2a] text-lg font-bold text-[#d6ef8d]">
              S
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-950">
              shopora
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setShowLocationDialog(true)}
            className="hidden shrink-0 rounded-xl px-2 py-1 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 md:block"
            aria-label="Choose a delivery location"
          >
            <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Location
            </span>
            <span className="block max-w-32 truncate text-xs font-semibold text-slate-800">
              {selectedCity
                ? `${selectedCity} ${selectedPincode}`
                : "Choose location"}
            </span>
          </button>

          <form
            onSubmit={handleSearch}
            className="relative flex min-w-0 flex-1 items-center overflow-visible rounded-full border border-slate-200 bg-[#f7f8f6] transition focus-within:border-teal-800 focus-within:ring-2 focus-within:ring-teal-800/15"
          >
            <label className="sr-only" htmlFor="marketplace-search">
              Search products
            </label>
            <input
              id="marketplace-search"
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={(event) => handleSearchInput(event.target.value)}
              onFocus={() => { setShowSuggestions(true); }}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setShowSuggestions(false); setFocusedSuggestionIndex(-1); return; }
                // Keyboard navigation is handled below in the dedicated handler
                const isEmptyInput = !search.trim();
                // Build the navigable items list to figure out total count
                let totalItems = 0;
                if (isEmptyInput) {
                  totalItems = recentSearches.length + TRENDING_SEARCHES.length;
                } else {
                  totalItems = suggestions.length; // +1 for "view all" handled via enter
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setFocusedSuggestionIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setFocusedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
                } else if (e.key === "Enter" && focusedSuggestionIndex >= 0 && showSuggestions) {
                  e.preventDefault();
                  if (isEmptyInput) {
                    // Navigate recent or trending
                    const allItems = [...recentSearches, ...TRENDING_SEARCHES];
                    const selectedTerm = allItems[focusedSuggestionIndex];
                    if (selectedTerm) {
                      setSearch(selectedTerm);
                      setShowSuggestions(false);
                      setFocusedSuggestionIndex(-1);
                      saveRecentSearch(selectedTerm);
                      router.push(`/products?query=${encodeURIComponent(selectedTerm)}`);
                    }
                  } else if (focusedSuggestionIndex < suggestions.length) {
                    const item = suggestions[focusedSuggestionIndex];
                    if (item) {
                      setShowSuggestions(false);
                      setSearch("");
                      setFocusedSuggestionIndex(-1);
                      saveRecentSearch(search.trim());
                      router.push(item.slug);
                    }
                  }
                }
              }}
              placeholder="Search products, brands, and more"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
            <label className="sr-only" htmlFor="marketplace-category">
              Search within a category
            </label>
            <select
              id="marketplace-category"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="hidden max-w-40 cursor-pointer border-l border-slate-200 bg-transparent px-3 py-2.5 text-xs text-slate-600 outline-none lg:block"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              aria-label="Search"
              className="grid h-10 w-11 shrink-0 place-items-center rounded-r-full bg-[#d6ef8d] text-slate-950 transition hover:bg-[#c6e274] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-teal-800"
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <circle cx="11" cy="11" r="7" strokeWidth="1.8" />
                <path d="m16 16 4 4" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>

            {showSuggestions && (() => {
              const isEmptyInput = !search.trim();
              const hasProductSuggestions = suggestions.length > 0;
              // Show dropdown if: empty input (recent/trending), or has typed something (show results or no-results)
              const shouldShow = isEmptyInput || search.trim().length > 0;
              if (!shouldShow) return null;

              // For empty input: build navigable items from recent + trending
              // For typed input: navigable items are the suggestions array
              let navIndex = 0;

              return (
                <div
                  ref={suggestionsRef}
                  className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl"
                >
                  {isEmptyInput ? (
                    <>
                      {/* Recent Searches */}
                      {recentSearches.length > 0 && (
                        <div className="border-b border-slate-100 px-3 py-2">
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Recent searches</p>
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearRecentSearches(); }}
                              className="text-[10px] font-medium text-slate-400 transition hover:text-rose-500"
                            >
                              Clear all
                            </button>
                          </div>
                          {recentSearches.map((term) => {
                            const itemIndex = navIndex++;
                            return (
                              <button
                                key={`recent-${term}`}
                                type="button"
                                onClick={() => {
                                  setSearch(term);
                                  setShowSuggestions(false);
                                  setFocusedSuggestionIndex(-1);
                                  saveRecentSearch(term);
                                  router.push(`/products?query=${encodeURIComponent(term)}`);
                                }}
                                className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition ${focusedSuggestionIndex === itemIndex ? "bg-slate-100" : "hover:bg-slate-50"}`}
                              >
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400">
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 8v4l3 3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="9" strokeWidth="1.8"/></svg>
                                </span>
                                <span className="truncate text-sm text-slate-600">{term}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Trending Searches */}
                      <div className="px-3 py-2">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Trending now</p>
                        {TRENDING_SEARCHES.map((term) => {
                          const itemIndex = navIndex++;
                          return (
                            <button
                              key={`trending-${term}`}
                              type="button"
                              onClick={() => {
                                setSearch(term);
                                setShowSuggestions(false);
                                setFocusedSuggestionIndex(-1);
                                saveRecentSearch(term);
                                router.push(`/products?query=${encodeURIComponent(term)}`);
                              }}
                              className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition ${focusedSuggestionIndex === itemIndex ? "bg-amber-50" : "hover:bg-amber-50/50"}`}
                            >
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-500">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </span>
                              <span className="truncate text-sm font-medium text-slate-700">{term}</span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : hasProductSuggestions ? (
                    <>
                      {/* Products */}
                      {suggestions.some((s) => s.type === "product") && (
                        <div className="border-b border-slate-100 px-3 py-2">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Products</p>
                          {suggestions
                            .filter((s) => s.type === "product")
                            .map((s) => {
                              const itemIndex = suggestions.indexOf(s);
                              return (
                                <Link
                                  key={s.slug}
                                  href={s.slug}
                                  onClick={() => { setShowSuggestions(false); setSearch(""); setFocusedSuggestionIndex(-1); saveRecentSearch(search.trim()); }}
                                  className={`flex items-center gap-3 rounded-xl px-2 py-2 transition ${focusedSuggestionIndex === itemIndex ? "bg-slate-100" : "hover:bg-slate-50"}`}
                                >
                                  {s.image ? (
                                    <img src={s.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                                  ) : (
                                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-xs text-slate-400">
                                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/></svg>
                                    </span>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-slate-900">{s.name}</p>
                                    {s.price != null && (
                                      <p className="text-xs font-semibold text-teal-700">{formatRupee(s.price)}</p>
                                    )}
                                  </div>
                                </Link>
                              );
                            })}
                        </div>
                      )}

                      {/* Brands */}
                      {suggestions.some((s) => s.type === "brand") && (
                        <div className="border-b border-slate-100 px-3 py-2">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Brands</p>
                          {suggestions
                            .filter((s) => s.type === "brand")
                            .map((s) => {
                              const itemIndex = suggestions.indexOf(s);
                              return (
                                <Link
                                  key={s.slug}
                                  href={s.slug}
                                  onClick={() => { setShowSuggestions(false); setSearch(""); setFocusedSuggestionIndex(-1); saveRecentSearch(search.trim()); }}
                                  className={`flex items-center gap-3 rounded-xl px-2 py-2 transition ${focusedSuggestionIndex === itemIndex ? "bg-slate-100" : "hover:bg-slate-50"}`}
                                >
                                  {s.image ? (
                                    <img src={s.image} alt="" className="h-8 w-8 rounded-lg object-contain bg-white" />
                                  ) : (
                                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-600">
                                      {s.name[0]}
                                    </span>
                                  )}
                                  <p className="truncate text-sm font-medium text-slate-900">{s.name}</p>
                                </Link>
                              );
                            })}
                        </div>
                      )}

                      {/* Categories */}
                      {suggestions.some((s) => s.type === "category") && (
                        <div className="border-b border-slate-100 px-3 py-2">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Categories</p>
                          {suggestions
                            .filter((s) => s.type === "category")
                            .map((s) => {
                              const itemIndex = suggestions.indexOf(s);
                              return (
                                <Link
                                  key={s.slug}
                                  href={s.slug}
                                  onClick={() => { setShowSuggestions(false); setSearch(""); setFocusedSuggestionIndex(-1); saveRecentSearch(search.trim()); }}
                                  className={`flex items-center gap-3 rounded-xl px-2 py-2 transition ${focusedSuggestionIndex === itemIndex ? "bg-slate-100" : "hover:bg-slate-50"}`}
                                >
                                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-50 text-teal-700">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 6h16M4 12h16M4 18h7" strokeWidth="1.8" strokeLinecap="round"/></svg>
                                  </span>
                                  <p className="truncate text-sm font-medium text-slate-900">{s.name}</p>
                                </Link>
                              );
                            })}
                        </div>
                      )}

                      {/* View all results link */}
                      <div className="px-3 py-2">
                        <Link
                          href={`/products?query=${encodeURIComponent(search.trim())}${selectedCategory ? `&category=${encodeURIComponent(selectedCategory)}` : ""}`}
                          onClick={() => { setShowSuggestions(false); setFocusedSuggestionIndex(-1); saveRecentSearch(search.trim()); }}
                          className="flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-teal-800 transition hover:bg-teal-50"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="11" cy="11" r="7" strokeWidth="1.8"/><path d="m16 16 4 4" strokeWidth="1.8" strokeLinecap="round"/></svg>
                          View all results for &lsquo;{search.trim()}&rsquo;
                        </Link>
                      </div>
                    </>
                  ) : (
                    /* No results found */
                    <div className="px-4 py-6 text-center">
                      <span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-400">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="11" cy="11" r="7" strokeWidth="1.8"/><path d="m16 16 4 4" strokeWidth="1.8" strokeLinecap="round"/></svg>
                      </span>
                      <p className="text-sm font-medium text-slate-600">No results found</p>
                      <p className="mt-1 text-xs text-slate-400">Try searching for something else</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </form>

          <div className="relative shrink-0" ref={accountMenuRef}>
            <button
              type="button"
              onClick={() => setShowAccountMenu((visible) => !visible)}
              aria-expanded={showAccountMenu}
              className="hidden rounded-xl px-2 py-1 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 sm:block"
            >
              <span className="block max-w-32 truncate text-[10px] text-slate-500">
                {user
                  ? `Hello, ${user.user_metadata?.full_name?.split(" ")[0] || "there"}`
                  : "Welcome"}
              </span>
              <span className="block text-xs font-semibold text-slate-900">
                {user ? "Your account" : "Sign in"}
              </span>
            </button>
            {showAccountMenu && (
              <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 text-sm shadow-xl">
                {user ? (
                  <>
                    <div className="border-b border-slate-100 px-3 py-2">
                      <p className="truncate font-semibold text-slate-900">
                        {user.user_metadata?.full_name || user.email}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                    </div>
                    <Link
                      href="/dashboard"
                      onClick={() => setShowAccountMenu(false)}
                      className="mt-1 block rounded-xl px-3 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Profile
                    </Link>
                    <Link
                      href="/dashboard"
                      onClick={() => setShowAccountMenu(false)}
                      className="block rounded-xl px-3 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Addresses
                    </Link>
                    <Link
                      href="/dashboard"
                      onClick={() => setShowAccountMenu(false)}
                      className="block rounded-xl px-3 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Orders
                    </Link>
                    <div className="border-t border-slate-100 mt-1 pt-1">
                      <button
                        type="button"
                        onClick={() => void handleSignOut()}
                        className="w-full rounded-xl px-3 py-2.5 text-left font-medium text-rose-700 transition hover:bg-rose-50"
                      >
                        Sign out
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-2 text-center">
                    <Link
                      href={`/auth/login?redirect=${encodeURIComponent(pathname)}`}
                      onClick={() => setShowAccountMenu(false)}
                      className="block rounded-full bg-slate-950 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-800"
                    >
                      Sign in
                    </Link>
                    <p className="mt-3 text-xs text-slate-500">
                      New to Shopora?{" "}
                      <Link
                        href="/auth/register"
                        onClick={() => setShowAccountMenu(false)}
                        className="font-semibold text-teal-900 underline-offset-2 hover:underline"
                      >
                        Create an account
                      </Link>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Wishlist icon */}
          <Link
            href="/wishlist"
            aria-label={`Wishlist, ${wishlistCount} ${wishlistCount === 1 ? "item" : "items"}`}
            className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-700 transition hover:text-[#ff3f6c]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            {wishlistCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#ff3f6c] px-0.5 text-[9px] font-bold text-white">
                {wishlistCount}
              </span>
            )}
          </Link>

          <Link
            href="/cart"
            aria-label={`Cart, ${totalItems} ${totalItems === 1 ? "item" : "items"}`}
            className="relative flex h-10 shrink-0 items-center gap-2 rounded-full bg-slate-950 px-3 text-white transition hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                d="M3 4h2l2.2 10.1a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 1.9-1.4L21 8H6"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="10" cy="20" r="1" />
              <circle cx="18" cy="20" r="1" />
            </svg>
            <span className="hidden text-xs font-semibold sm:inline">
              {totalAmount > 0 ? formatRupee(totalAmount) : "Cart"}
            </span>
            {totalItems > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#d6ef8d] px-1 text-[10px] font-bold text-slate-950">
                {totalItems}
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={() => setShowMobileMenu((visible) => !visible)}
            aria-expanded={showMobileMenu}
            aria-label={showMobileMenu ? "Close category navigation" : "Open category navigation"}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-800 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 md:hidden"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {showMobileMenu ? (
                <path d="m6 6 12 12M18 6 6 18" strokeWidth="1.8" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" strokeWidth="1.8" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>

        {/* Myntra-style Category Nav Bar */}
        <nav
          aria-label="Product categories"
          className="relative hidden border-t border-[#e1ebe5] bg-white md:block"
          onMouseLeave={handleMegaMenuLeave}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-center">
            {/* Main nav links - Myntra style */}
            <div className="flex items-center">
              <Link
                href="/products"
                onMouseEnter={() => handleMegaMenuEnter("__all__")}
                className={`mega-nav-link relative px-5 py-3.5 text-sm font-bold uppercase tracking-wide transition ${
                  hoveredCategory === "__all__"
                    ? "text-[#ee5f73]"
                    : "text-slate-800 hover:text-[#ee5f73]"
                }`}
              >
                All
                {hoveredCategory === "__all__" && (
                  <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#ee5f73]" />
                )}
              </Link>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/products?category=${encodeURIComponent(category.name)}`}
                  onMouseEnter={() => handleMegaMenuEnter(category.name)}
                  className={`mega-nav-link relative px-5 py-3.5 text-sm font-bold uppercase tracking-wide transition ${
                    hoveredCategory === category.name
                      ? "text-[#ee5f73]"
                      : "text-slate-800 hover:text-[#ee5f73]"
                  }`}
                >
                  {category.name}
                  {hoveredCategory === category.name && (
                    <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#ee5f73]" />
                  )}
                </Link>
              ))}
              <Link
                href="/collections"
                className="mega-nav-link relative px-5 py-3.5 text-sm font-bold uppercase tracking-wide text-slate-800 transition hover:text-[#ee5f73]"
              >
                Collections
              </Link>
              <Link
                href="/brands"
                className="mega-nav-link relative px-5 py-3.5 text-sm font-bold uppercase tracking-wide text-slate-800 transition hover:text-[#ee5f73]"
              >
                Brands
              </Link>
            </div>
          </div>

          {/* Mega Menu Dropdown Panel — Myntra style */}
          {hoveredCategory && MEGA_MENU_DATA[hoveredCategory] && (
            <div
              className="mega-menu-enter absolute left-0 right-0 top-full z-50 border-b border-slate-200 bg-white shadow-xl"
              onMouseEnter={() => handleMegaMenuEnter(hoveredCategory)}
              onMouseLeave={handleMegaMenuLeave}
            >
              <div className="mx-auto flex max-w-7xl gap-0 px-8 py-6">
                {MEGA_MENU_DATA[hoveredCategory].map((column, colIdx) => (
                  <div key={colIdx} className="min-w-[170px] flex-1 px-4">
                    <h3 className="mb-3 border-b-2 border-[#ee5f73] pb-2 text-sm font-bold text-[#ee5f73]">
                      {column.title}
                    </h3>
                    <ul className="space-y-0">
                      {column.items.map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={closeMegaMenu}
                            className="block py-1.5 text-sm text-slate-600 transition hover:font-medium hover:text-slate-900"
                          >
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </nav>

        {showMobileMenu && (
          <nav
            aria-label="Mobile product categories"
            className="border-t border-[#e1ebe5] bg-gradient-to-r from-[#f7f8f6] via-white to-[#f7f8f6] px-4 py-3 md:hidden"
          >
            <div className="scrollbar-hide flex gap-2 overflow-x-auto">{mobileCategoryLinks}</div>
            <button
              type="button"
              onClick={() => setShowLocationDialog(true)}
              className="mt-2 w-full rounded-xl bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-700"
            >
              {selectedCity
                ? `Location: ${selectedCity} ${selectedPincode}`
                : "Choose a location"}
            </button>
            {!user && (
              <Link
                href={`/auth/login?redirect=${encodeURIComponent(pathname)}`}
                onClick={() => setShowMobileMenu(false)}
                className="mt-2 block rounded-xl px-3 py-2 text-sm font-semibold text-teal-900"
              >
                Customer sign in
              </Link>
            )}
          </nav>
        )}
      </header>

      {showLocationDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowLocationDialog(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-dialog-title"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="location-dialog-title" className="text-lg font-semibold">
                  Choose your location
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Save a city and PIN code preference for browsing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLocationDialog(false)}
                aria-label="Close location dialog"
                className="grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {CITIES.map((city) => (
                <button
                  key={city.pincode}
                  type="button"
                  onClick={() => handleSelectCity(city)}
                  className="rounded-xl border border-slate-200 px-3 py-3 text-left transition hover:border-teal-800 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-800"
                >
                  <span className="block text-sm font-semibold text-slate-900">
                    {city.name}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {city.pincode}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
