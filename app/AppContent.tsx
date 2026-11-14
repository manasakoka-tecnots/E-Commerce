"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import Navbar from "@/src/components/Navbar";
import ProductCard from "@/src/components/ProductCard";
import Spinner from "@/src/components/Spinner";
import Footer from "@/src/components/Footer";
import {
  attachCategoryNames,
  fetchCatalogCategories,
  fetchCatalogProducts,
  getProductImageUrl,
  patchLocalUploads,
  type CatalogCategory,
  type ProductCardData,
} from "@/src/lib/catalog";
import { supabase } from "@/src/lib/supabase/client";
import { fetchBrands, type Brand } from "@/src/lib/brands";

const CATEGORY_COLORS = [
  "bg-emerald-50",
  "bg-sky-50",
  "bg-rose-50",
  "bg-violet-50",
  "bg-amber-50",
];

const CATEGORY_PHOTOS: Record<string, { src: string; alt: string }> = {
  "audio & headphones": {
    src: "/category-images/audio-headphones.jpg",
    alt: "Headphones and audio equipment",
  },
  "automotive accessories": {
    src: "/category-images/automotive.jpg",
    alt: "Close-up of automotive engine components",
  },
  "beauty & personal care": {
    src: "/category-images/beauty.jpg",
    alt: "Skincare and hair-care product packaging",
  },
  "bluetooth speakers": {
    src: "/category-images/bluetooth-speakers.jpg",
    alt: "Portable bluetooth speaker",
  },
  "books & stationery": {
    src: "/category-images/books.jpg",
    alt: "A row of books on a shelf",
  },
  "cables & chargers": {
    src: "/category-images/cables-chargers.jpg",
    alt: "USB cables and phone chargers",
  },
  "computers & laptops": {
    src: "/category-images/computers-laptops.jpg",
    alt: "Laptop on a clean workspace",
  },
  "footwear": {
    src: "/category-images/footwear.jpg",
    alt: "Stylish red sneaker on gradient background",
  },
  "furniture & home décor": {
    src: "/category-images/furniture-home-decor.jpg",
    alt: "Modern green sofa in a living room",
  },
  "grocery & daily essentials": {
    src: "/category-images/grocery.jpg",
    alt: "Fresh fruits and vegetables at a market",
  },
  "health & wellness": {
    src: "/category-images/health-wellness.jpg",
    alt: "Healthy food and wellness items",
  },
  "home & kitchen": {
    src: "/category-images/kitchen.jpg",
    alt: "Bright kitchen with cookware and utensils",
  },
  "kids' fashion": {
    src: "/category-images/kids-fashion.jpg",
    alt: "Child wearing a sweater and trousers",
  },
  "men's fashion": {
    src: "/category-images/mens-fashion.jpg",
    alt: "Men's casual fashion clothing",
  },
  "mobiles & electronics": {
    src: "/category-images/mobiles-electronics.jpg",
    alt: "Smartphone on a dark background",
  },
  "pet supplies": {
    src: "/category-images/pets.jpg",
    alt: "A cat and dog resting together",
  },
  "sports & fitness": {
    src: "/category-images/sports.jpg",
    alt: "Athlete training with weights",
  },
  "toys & baby products": {
    src: "/category-images/toys.jpg",
    alt: "Colorful wooden toy train set",
  },
  "women's fashion": {
    src: "/category-images/womens-fashion.jpg",
    alt: "Woman carrying shopping bags",
  },
};

function CatalogImage({
  product,
  className,
}: {
  product: ProductCardData;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  const imageUrl = failed ? null : getProductImageUrl(product.imageStoragePath);

  return imageUrl ? (
    <Image
      src={imageUrl}
      alt={product.imageAlt || product.name}
      fill
      unoptimized
      sizes="(max-width: 768px) 40vw, 320px"
      className={className}
      onError={() => setFailed(true)}
    />
  ) : (
    <Image
      src="/placeholder-product.svg"
      alt={`Image unavailable for ${product.name}`}
      fill
      sizes="(max-width: 768px) 40vw, 320px"
      className={className}
    />
  );
}

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

/* ── Winter Sale Countdown Timer ── */
const SALE_END = new Date("2027-02-28T23:59:59+05:30").getTime(); // Winter sale ends Feb 28

function SaleCountdown({ compact = false }: { compact?: boolean }) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number; hours: number; minutes: number; seconds: number;
  } | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    function calcRemaining() {
      const diff = SALE_END - Date.now();
      if (diff <= 0) { setExpired(true); setTimeLeft(null); return; }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    }
    calcRemaining();
    const id = setInterval(calcRemaining, 1000);
    return () => clearInterval(id);
  }, []);

  if (expired) return <span className={`font-bold ${compact ? "text-xs text-sky-200" : "text-base text-sky-300"}`}>Sale Ended</span>;
  if (!timeLeft) return null;

  const units = [
    { label: "Days", value: timeLeft.days },
    { label: "Hrs", value: timeLeft.hours },
    { label: "Min", value: timeLeft.minutes },
    { label: "Sec", value: timeLeft.seconds },
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {units.map((u) => (
          <div key={u.label} className="flex flex-col items-center rounded-md bg-black/40 px-1.5 py-0.5 backdrop-blur">
            <span className="text-xs font-bold tabular-nums leading-tight text-sky-300">{String(u.value).padStart(2, "0")}</span>
            <span className="text-[8px] uppercase tracking-wider text-sky-100/70">{u.label}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {units.map((u, i) => (
        <div key={u.label} className="flex items-center gap-2 sm:gap-3">
          <div className="flex flex-col items-center rounded-xl bg-black/50 px-3 py-2 sm:px-4 sm:py-3 backdrop-blur" style={{ boxShadow: "0 0 16px rgba(56,189,248,0.3)" }}>
            <span className="text-2xl font-extrabold tabular-nums leading-none text-sky-400 sm:text-3xl" style={{ textShadow: "0 0 12px rgba(56,189,248,0.6)" }}>{String(u.value).padStart(2, "0")}</span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-sky-200/80">{u.label}</span>
          </div>
          {i < units.length - 1 && <span className="text-xl font-bold text-sky-400/60 sm:text-2xl">:</span>}
        </div>
      ))}
    </div>
  );
}

/* ── Snowflake SVG ── */
function Snowflake({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2v4m0 12v4m-6.93-2.93l2.83-2.83m8.2-8.2l2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.2 8.2l2.83 2.83M12 8a4 4 0 100 8 4 4 0 000-8z" />
    </svg>
  );
}

/* ── Winter Sale Banner ── */
function SaleBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-sky-900 to-slate-900 text-white">
      <div className="winter-gradient-slide absolute inset-0 opacity-15" />
      <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Snowflake className="h-6 w-6 shrink-0 text-sky-300" />
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="hidden sm:inline font-extrabold text-sky-300 text-base tracking-wider">WINTER SALE</span>
            <span>CHILL DEALS ARE LIVE</span>
            <span className="hidden sm:inline">—</span>
            <span className="hidden sm:inline text-sky-200">Up to 70% off winter essentials!</span>
            <span className="inline sm:hidden text-sky-200">Up to 70% off!</span>
          </div>
          <Snowflake className="hidden h-6 w-6 shrink-0 text-sky-300 sm:block" />
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <SaleCountdown compact />
          </div>
          <Link href="/products" className="shrink-0 rounded-full bg-sky-400 px-4 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-sky-300">
            Shop Now
          </Link>
          <button onClick={() => setDismissed(true)} className="shrink-0 rounded-full p-1 text-white/70 transition hover:bg-white/20 hover:text-white" aria-label="Dismiss banner">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppContent() {
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [listingError, setListingError] = useState<string | null>(null);
  const [collections, setCollections] = useState<{ id: string; title: string; description: string | null; image_url: string | null; product_count: number }[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  useEffect(() => {
    fetchBrands().then(setBrands);
  }, []);

  useEffect(() => {
    // Load collections with product counts in a single query
    (async () => {
      try {
        const { data } = await supabase
          .from("collections")
          .select("id, title, description, image_url, is_active, collection_products(id)")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(6);
        if (!data || data.length === 0) return;
        setCollections(data.map(col => ({
          id: col.id,
          title: col.title,
          description: col.description,
          image_url: col.image_url,
          product_count: Array.isArray(col.collection_products) ? col.collection_products.length : 0,
        })));
      } catch { /* ignore */ }
    })();
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
        console.warn("Could not load storefront categories:", loadError);
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
        setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const loadStorefront = () => {
    setLoading(true);
    setError(null);
    const categoriesRequest = fetchCatalogCategories()
      .then((catalogCategories) => {
        setCategories(catalogCategories);
        setCategoryError(null);
        return catalogCategories;
      })
      .catch((loadError: unknown) => {
        console.warn("Could not load storefront categories:", loadError);
        setCategories([]);
        setCategoryError(getErrorMessage(loadError));
        return [];
      });

    Promise.all([fetchCatalogProducts(), categoriesRequest])
      .then(async ([catalogResult, catalogCategories]) => {
        const patched = await patchLocalUploads(catalogResult.products);
        setProducts(attachCategoryNames(patched, catalogCategories));
        setListingError(catalogResult.listingError);
      })
      .catch((loadError: unknown) => {
        setError(getErrorMessage(loadError));
        setProducts([]);
      })
      .finally(() => setLoading(false));
  };

  const isNewProduct = (p: typeof products[0]) => {
    if (!p.createdAt) return false;
    const now = Date.now();
    return (now - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24) <= 7;
  };

  // New arrivals: products added in the last 7 days
  const newArrivals = products.filter(isNewProduct);

  // Top Deals: pick products with the best discounts, excluding new arrivals
  const newArrivalIds = new Set(newArrivals.map((p) => p.id));
  const topDeals = products
    .filter((p) => !newArrivalIds.has(p.id) && p.price != null)
    .sort((a, b) => {
      const discountA = a.referencePrice && a.referencePrice > (a.price ?? 0)
        ? (a.referencePrice - (a.price ?? 0)) / a.referencePrice
        : 0;
      const discountB = b.referencePrice && b.referencePrice > (b.price ?? 0)
        ? (b.referencePrice - (b.price ?? 0)) / b.referencePrice
        : 0;
      return discountB - discountA;
    })
    .slice(0, 5);

  const heroProducts = [
    // Prioritize new arrivals with images for the hero
    ...newArrivals.filter((p) => p.imageStoragePath),
    ...products.filter((p) => p.imageStoragePath && !isNewProduct(p)),
    ...products.filter((p) => !p.imageStoragePath),
  ].slice(0, 3);

  // Marquee shows new arrivals first, then other products
  const marqueeProducts = [
    ...newArrivals,
    ...products.filter((p) => !isNewProduct(p)),
  ].slice(0, 10);

  return (
    <div className="flex min-h-screen flex-col bg-[#faf9f6] text-slate-950">
      <Navbar />
      <SaleBanner />

      <main className="relative isolate flex-1 overflow-x-clip">
        {/* ── Floating Winter Decorations ── */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          <Snowflake className="sale-float absolute left-[3%] top-[20%] h-6 w-6 text-sky-400/30" />
          <Snowflake className="sale-float-delay-1 absolute right-[4%] top-[35%] h-5 w-5 text-sky-300/25" />
          <Snowflake className="sale-float-delay-2 absolute left-[6%] top-[60%] h-5 w-5 text-sky-400/20" />
          <Snowflake className="sale-float absolute right-[5%] top-[75%] h-4 w-4 text-sky-300/20" />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 hidden overflow-hidden text-[#718d7c] opacity-[0.52] lg:block"
        >
          <svg
            viewBox="0 0 48 48"
            className="absolute left-1 top-[14%] h-9 w-9"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.3"
          >
            <path d="M5 11h4l5 22h21l5-16H12M17 39h.1M33 39h.1" />
            <circle cx="17" cy="39" r="2" />
            <circle cx="33" cy="39" r="2" />
          </svg>
          <svg
            viewBox="0 0 48 48"
            className="absolute right-1 top-[31%] h-9 w-9"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.3"
          >
            <path d="M5 14 24 4l19 10v24H5V14Zm0 0 19 11 19-11M24 25v13M24 4v21" />
          </svg>
          <svg
            viewBox="0 0 48 48"
            className="absolute left-1 top-[48%] h-9 w-9"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.3"
          >
            <path d="M8 14h32v27H8zM8 14l16 13 16-13M24 27v14" />
          </svg>
          <svg
            viewBox="0 0 48 48"
            className="absolute right-1 top-[64%] h-9 w-9"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.3"
          >
            <path d="M5 22v-5a13 13 0 0 1 26 0v5M5 22v9a4 4 0 0 0 4 4h3V21H9a4 4 0 0 0-4 4Zm26 0v9a4 4 0 0 1-4 4h-3V21h3a4 4 0 0 1 4 4Z" />
          </svg>
          <svg
            viewBox="0 0 48 48"
            className="absolute left-1 top-[80%] h-9 w-9"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.3"
          >
            <path d="m5 14 29-8 9 23-29 8L5 14Zm13 6 8 8" />
          </svg>
          <svg
            viewBox="0 0 48 48"
            className="absolute right-1 top-[93%] h-9 w-9"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.3"
          >
            <path d="M4 22h7l5-12h16l8 12h5v15H4V22Zm7 0h24M12 37a4 4 0 1 0 8 0m14 0a4 4 0 1 0 8 0" />
          </svg>
          <svg
            viewBox="0 0 48 48"
            className="absolute left-1 top-[58%] h-9 w-9"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.3"
          >
            <path d="M6 17h36l-3 27H9L6 17Zm10 0a8 8 0 0 1 16 0" />
          </svg>
          <svg
            viewBox="0 0 48 48"
            className="absolute right-1 top-[75%] h-9 w-9"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.3"
          >
            <path d="M5 11h4l5 22h21l5-16H12M17 39h.1M33 39h.1" />
            <circle cx="17" cy="39" r="2" />
            <circle cx="33" cy="39" r="2" />
          </svg>
        </div>
        <div className="relative z-10">
        <section className="relative isolate mx-auto max-w-7xl px-4 pb-10 pt-5 sm:px-6 sm:pb-16 sm:pt-8 lg:px-8">
          <svg
            aria-hidden="true"
            viewBox="0 0 1440 480"
            preserveAspectRatio="none"
            className="pointer-events-none absolute left-1/2 top-0 z-0 hidden h-full w-screen -translate-x-1/2 text-[#718d7c] opacity-20 lg:block"
          >
            <g
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            >
              <g transform="translate(-8 42) rotate(-8 18 18)">
                <path d="M5 22v-5a13 13 0 0 1 26 0v5M5 22v9a4 4 0 0 0 4 4h3V21H9a4 4 0 0 0-4 4Zm26 0v9a4 4 0 0 1-4 4h-3V21h3a4 4 0 0 1 4 4Z" />
              </g>
              <g transform="translate(-10 215) rotate(7 20 20)">
                <path d="M5 11h4l5 22h21l5-16H12M17 39h.1M33 39h.1" />
                <circle cx="17" cy="39" r="2" />
                <circle cx="33" cy="39" r="2" />
              </g>
              <g transform="translate(-8 394) rotate(-5 20 20)">
                <path d="M5 14 24 4l19 10v24H5V14Zm0 0 19 11 19-11M24 25v13M24 4v21" />
              </g>
              <g transform="translate(1410 50) rotate(6 20 20)">
                <path d="M6 17h34l-3 27H9L6 17Zm9 0a8 8 0 0 1 16 0" />
              </g>
              <g transform="translate(1400 218) rotate(-7 20 20)">
                <path d="m5 14 29-8 9 23-29 8L5 14Zm13 6 8 8" />
              </g>
              <g transform="translate(1396 390) rotate(5 24 22)">
                <path d="M4 22h7l5-12h16l8 12h5v15H4V22Zm7 0h24M12 37a4 4 0 1 0 8 0m14 0a4 4 0 1 0 8 0" />
              </g>
            </g>
          </svg>
          <div className="hero-panel relative z-10 isolate overflow-hidden rounded-[2rem] bg-[#f7f7f0] px-6 py-10 text-slate-950 sm:px-10 sm:py-14 lg:min-h-[470px] lg:px-14">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,_#edf5ee_0%,_#faf9f3_48%,_#f4f3e9_100%)]"
            />
            <svg
              aria-hidden="true"
              viewBox="0 0 1200 480"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full text-[#718d7c] opacity-[0.12] max-sm:opacity-[0.06]"
            >
              <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5">
                <path d="M-30 320C180 210 340 430 560 326S920 215 1230 326" />
                <path d="M-40 350C170 245 350 460 570 356S925 245 1240 356" />
                <path d="M-30 384C190 280 365 490 585 390S945 280 1230 390" />
              </g>
              <g
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              >
                <g transform="translate(95 78)">
                  <path d="M5 25v-6a18 18 0 0 1 36 0v6M5 25v11a5 5 0 0 0 5 5h4V24h-4a5 5 0 0 0-5 5Zm36 0v11a5 5 0 0 1-5 5h-4V24h4a5 5 0 0 1 5 5Z" />
                </g>
                <g transform="translate(400 47)">
                  <path d="M4 10h5l5 23h22l5-16H12M18 40h.1M34 40h.1" />
                  <circle cx="18" cy="40" r="2.5" />
                  <circle cx="34" cy="40" r="2.5" />
                </g>
                <g transform="translate(1070 78)">
                  <path d="M6 17h34l-3 27H9L6 17Zm9 0a8 8 0 0 1 16 0" />
                </g>
                <g transform="translate(740 402)">
                  <path d="M4 15 24 4l20 11v25H4V15Zm0 0 20 12 20-12M24 27v13M24 4v23" />
                </g>
                <g transform="translate(1070 365)">
                  <path d="m5 14 29-8 9 23-29 8L5 14Zm13 6 8 8" />
                </g>
                <g transform="translate(575 82)">
                  <path d="M4 22h7l5-12h16l8 12h5v15H4V22Zm7 0h24M12 37a4 4 0 1 0 8 0m14 0a4 4 0 1 0 8 0" />
                </g>
              </g>
            </svg>
            <div className="relative z-10 grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="max-w-2xl">
                <p className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-teal-900">
                  <span className="inline-block rounded-full bg-gradient-to-r from-sky-600 to-cyan-400 px-3 py-1 text-[10px] font-bold tracking-wider text-white">WINTER SALE</span>
                  A marketplace for everyday discoveries
                </p>
                <h1 className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                  Find the things that make life feel more like you.
                </h1>
                <p className="mt-5 max-w-lg text-sm leading-6 text-slate-700 sm:text-base">
                  Explore electronics, home, fashion, beauty, and more in one
                  thoughtful marketplace.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/products"
                    className="rounded-full bg-[#102e2a] px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-900"
                  >
                    Shop the catalog
                  </Link>
                  <Link
                    href="#categories"
                    className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-800 transition hover:border-teal-800 hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-900"
                  >
                    Explore categories
                  </Link>
                </div>
              </div>

              <div className="relative mx-auto h-[280px] w-full max-w-[500px] sm:h-[330px]">
                <div
                  aria-hidden="true"
                  className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-800/10 blur-2xl sm:h-72 sm:w-72"
                />
                {heroProducts.map((product, index) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.id}`}
                    className={`absolute block overflow-hidden rounded-3xl border border-white bg-white shadow-xl transition duration-300 hover:-translate-y-2 ${
                      index === 0
                        ? "left-[5%] top-[15%] h-44 w-36 rotate-[-8deg] sm:h-56 sm:w-44"
                        : index === 1
                          ? "right-[4%] top-[5%] h-48 w-40 rotate-[8deg] sm:h-60 sm:w-48"
                          : "bottom-[1%] left-[31%] h-36 w-32 rotate-[2deg] sm:h-44 sm:w-40"
                    }`}
                  >
                    <CatalogImage product={product} className="object-contain p-4" />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-white/95 px-3 py-2 text-[11px] font-semibold text-slate-800">
                      {product.name}
                    </span>
                  </Link>
                ))}
                {heroProducts.length === 0 && (
                  <div
                    aria-hidden="true"
                    className="absolute inset-5 rounded-[2rem] border border-teal-900/10 bg-gradient-to-br from-teal-300/20 via-transparent to-lime-200/20"
                  />
                )}
              </div>
            </div>
          </div>
        </section>

        {marqueeProducts.length > 0 && (
          <section
            aria-label="Featured marketplace finds"
            className="catalog-marquee mx-auto max-w-7xl border-y border-emerald-950/10 py-4"
          >
            <p className="sr-only">
              A moving showcase of featured marketplace products.
            </p>
            <div
              aria-hidden="true"
              className="catalog-marquee-track flex w-max gap-4 px-4 sm:px-6 lg:px-8"
            >
              {[...marqueeProducts, ...marqueeProducts].map((product, index) => (
                <Link
                  href={`/products/${product.id}`}
                  key={`${product.id}-${index}`}
                  className="group flex h-24 w-56 shrink-0 items-center gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm transition-transform duration-300 hover:-translate-y-1 sm:w-64"
                >
                  <div className="relative h-full w-24 shrink-0 overflow-hidden rounded-xl bg-[#f1f3ed]">
                    <CatalogImage
                      product={product}
                      className="object-contain p-2 transition-transform duration-300 group-hover:scale-110"
                    />
                    {isNewProduct(product) && (
                      <span className="absolute left-1 top-1 rounded bg-gradient-to-r from-rose-500 to-orange-500 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white shadow-sm">
                        New
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 pr-2">
                    <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900">
                      {product.name}
                    </p>
                    <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-800">
                      {isNewProduct(product) ? "New arrival" : (product.category || "Shopora pick")}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Myntra-style Perks Strip */}
        <section className="border-y border-slate-200 bg-white py-4">
          <div className="mx-auto flex max-w-7xl items-center justify-around gap-4 px-4 sm:px-6 lg:px-8">
            {[
              { icon: "M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21M3.375 14.25h4.875c.621 0 1.125-.504 1.125-1.125v-3.375c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v3.375c0 .621.504 1.125 1.125 1.125zm0 0V7.5A2.25 2.25 0 015.625 5.25h12.75A2.25 2.25 0 0120.625 7.5v6.75", label: "Free Delivery", sub: "On orders above ₹499" },
              { icon: "M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3", label: "Easy Returns", sub: "Within 30 days" },
              { icon: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z", label: "100% Authentic", sub: "Verified sellers" },
              { icon: "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z", label: "Secure Payment", sub: "UPI, Cards & COD" },
            ].map((perk) => (
              <div key={perk.label} className="flex items-center gap-3 text-center sm:text-left">
                <div className="hidden shrink-0 rounded-full bg-pink-50 p-2.5 sm:block">
                  <svg className="h-5 w-5 text-[#ff3f6c]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d={perk.icon} />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 sm:text-sm">{perk.label}</p>
                  <p className="hidden text-[11px] text-slate-500 sm:block">{perk.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          id="categories"
          className="mx-auto max-w-7xl scroll-mt-32 rounded-3xl bg-[radial-gradient(ellipse_at_top,_rgba(20,83,75,0.045),_transparent_68%),_#f7f8f6] px-4 py-8 sm:px-6 lg:px-8"
        >
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">
                Start exploring
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Shop by category
              </h2>
            </div>
            <Link
              href="/products"
              className="hidden text-sm font-semibold text-slate-700 transition hover:text-teal-800 sm:inline-flex"
            >
              View all products <span aria-hidden="true" className="ml-2">→</span>
            </Link>
          </div>

          {loading ? (
            <div className="flex min-h-40 items-center justify-center">
              <Spinner />
            </div>
          ) : categories.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {categories.map((category, index) => {
                const categoryProduct = products.find(
                  (product) =>
                    product.category?.toLowerCase() === category.name.toLowerCase() &&
                    product.imageStoragePath
                );
                // Priority: DB image_url > hardcoded fallback
                const categoryImageSrc = category.image_url || CATEGORY_PHOTOS[category.name.toLowerCase()]?.src;
                const categoryImageAlt = CATEGORY_PHOTOS[category.name.toLowerCase()]?.alt || category.name;
                return (
                  <Link
                    key={category.id}
                    href={`/products?category=${encodeURIComponent(category.name)}`}
                    className={`group relative flex min-h-36 items-end overflow-hidden rounded-2xl bg-gradient-to-br ${
                      CATEGORY_COLORS[index % CATEGORY_COLORS.length]
                    } p-4 transition duration-200 hover:-translate-y-1 hover:shadow-lg sm:min-h-48`}
                  >
                    {categoryProduct && !categoryImageSrc && (
                      <CatalogImage
                        product={categoryProduct}
                        className="object-contain p-4 opacity-80 transition-transform duration-300 group-hover:scale-105"
                      />
                    )}
                    {categoryImageSrc && (
                      <Image
                        src={categoryImageSrc}
                        alt={categoryImageAlt}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    )}
                    <span className="relative z-10 rounded-full bg-white/90 px-3 py-2 text-sm font-semibold text-slate-900 backdrop-blur">
                      {category.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
              <p className="text-sm text-slate-600">
                {categoryError
                  ? `Categories are temporarily unavailable: ${categoryError}`
                  : "Categories will appear here as they are added to the catalog."}
              </p>
              {categoryError?.toLowerCase().includes("permission denied") && (
                <p className="mt-2 text-sm text-slate-600">
                  Apply the latest Supabase migration to enable category navigation.
                </p>
              )}
              <Link
                href="/products"
                className="mt-4 inline-flex rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                Browse products
              </Link>
            </div>
          )}
        </section>

        {/* ── Shop by Brand ── */}
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Shop by Brand
              </h2>
            </div>
            <Link
              href="/brands"
              className="hidden text-sm font-semibold text-slate-700 transition hover:text-teal-800 sm:inline-flex"
            >
              View all brands <span aria-hidden="true" className="ml-2">→</span>
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {brands.map((brand) => (
              <Link
                key={brand.slug}
                href={`/brands/${brand.slug}`}
                className="group flex shrink-0 flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-300 hover:shadow-md"
                style={{ minWidth: "110px" }}
              >
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-slate-50 p-1.5">
                  {brand.logo_url ? (
                    <img
                      src={brand.logo_url}
                      alt={brand.name}
                      className="h-full w-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-lg font-bold text-slate-400">${brand.name[0]}</span>`;
                      }}
                    />
                  ) : (
                    <span className="text-lg font-bold text-slate-400">{brand.name[0]}</span>
                  )}
                </div>
                <span className="text-xs font-semibold text-slate-700 group-hover:text-teal-800">
                  {brand.name}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Winter Sale Deals Section ── */}
        {!loading && topDeals.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 p-8 sm:p-10">
              {/* Decorative snowflake pattern */}
              <div className="pointer-events-none absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle, rgba(186,230,253,0.3) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
              </div>
              {/* Floating winter elements */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <Snowflake className="sale-float absolute left-[5%] top-[10%] h-8 w-8 text-sky-400/30" />
                <Snowflake className="sale-float-delay-1 absolute right-[8%] top-[15%] h-7 w-7 text-sky-300/30" />
                <Snowflake className="sale-float-delay-2 absolute left-[50%] top-[8%] h-6 w-6 text-cyan-300/25" />
              </div>
              <div className="relative z-10">
                <div className="mb-8 text-center">
                  <div className="mb-3 flex items-center justify-center gap-3">
                    <Snowflake className="h-8 w-8 text-sky-300" />
                    <h2 className="text-3xl font-bold text-white sm:text-4xl">
                      Winter <span className="text-sky-400">Sale</span> Deals
                    </h2>
                    <Snowflake className="h-8 w-8 text-sky-300" />
                  </div>
                  <p className="text-sky-200/80">
                    Cozy up with the biggest discounts of the season!
                  </p>
                  {/* Countdown timer */}
                  <div className="mt-5 flex justify-center">
                    <SaleCountdown />
                  </div>
                  {/* Sale badges */}
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                    <span className="winter-glow inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-600 to-cyan-400 px-4 py-1.5 text-sm font-bold text-white">
                      Winter Special
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-sky-100 backdrop-blur">
                      Up to 70% Off
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-sky-100 backdrop-blur">
                      Free Delivery
                    </span>
                  </div>
                </div>
                {/* Deal cards */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {topDeals.map((product) => (
                    <Link
                      key={product.id}
                      href={`/products/${product.id}`}
                      className="group relative overflow-hidden rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                    >
                      <div className="absolute right-2 top-2 z-10">
                        <span className="winter-glow inline-block rounded-full bg-gradient-to-r from-sky-600 to-cyan-400 px-2.5 py-1 text-[10px] font-bold text-white">
                          WINTER DEAL
                        </span>
                      </div>
                      <div className="relative aspect-square overflow-hidden rounded-xl bg-[#f8f6f0]">
                        <CatalogImage
                          product={product}
                          className="object-contain p-3 transition-transform duration-300 group-hover:scale-110"
                        />
                      </div>
                      <div className="mt-2.5 px-1">
                        <p className="line-clamp-2 text-sm font-semibold leading-tight text-slate-900">
                          {product.name}
                        </p>
                        {product.price != null && (
                          <div className="mt-1.5 flex items-baseline gap-2">
                            <span className="text-base font-bold text-sky-700">
                              ₹{product.price.toLocaleString("en-IN")}
                            </span>
                            {product.referencePrice != null && product.referencePrice > product.price && (
                              <>
                                <span className="text-xs text-slate-400 line-through">
                                  ₹{product.referencePrice.toLocaleString("en-IN")}
                                </span>
                                <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">
                                  {Math.round(((product.referencePrice - product.price) / product.referencePrice) * 100)}% OFF
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="mt-6 text-center">
                  <Link
                    href="/products"
                    className="inline-flex items-center gap-2 rounded-full bg-sky-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-sky-300"
                  >
                    View All Deals
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {!loading && newArrivals.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg>
                    New
                  </span>
                  <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    New Arrivals
                  </h2>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Just landed — fresh picks added in the last 7 days
                </p>
              </div>
              <Link
                href="/products"
                className="text-sm font-semibold text-slate-700 transition hover:text-teal-800"
              >
                View all <span aria-hidden="true" className="ml-1">→</span>
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-slate-200 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {newArrivals.slice(0, 5).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* ── Featured Collections ── */}
        {!loading && collections.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" /></svg>
                    Curated
                  </span>
                  <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    Featured Collections
                  </h2>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Handpicked collections from our sellers — themed picks to help you find what you need
                </p>
              </div>
              <Link
                href="/collections"
                className="text-sm font-semibold text-slate-700 transition hover:text-teal-800"
              >
                View all <span aria-hidden="true" className="ml-1">&rarr;</span>
              </Link>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {collections.map((col) => (
                <Link
                  key={col.id}
                  href={`/collections/${col.id}`}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
                >
                  <div className="relative aspect-[16/9] bg-gradient-to-br from-amber-50 to-orange-50">
                    {col.image_url ? (
                      <Image
                        src={col.image_url}
                        alt={col.title}
                        fill
                        unoptimized
                        className="object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <svg className="h-10 w-10 text-amber-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-slate-900 transition group-hover:text-teal-800">{col.title}</h3>
                    {col.description && (
                      <p className="mt-1 line-clamp-1 text-sm text-slate-500">{col.description}</p>
                    )}
                    <p className="mt-2 text-xs text-slate-400">{col.product_count} {col.product_count === 1 ? "product" : "products"}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">
                Straight from the marketplace
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Shop all products
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Browse approved catalog items. Live prices and availability appear
                only when a seller offer is active.
              </p>
              {!loading && !error && (
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {products.length} {products.length === 1 ? "product" : "products"}
                </p>
              )}
              {!loading && !error && listingError && (
                <p role="status" className="mt-2 max-w-xl text-xs text-amber-800">
                  Products are shown, but live prices and stock could not be loaded.
                  Apply the latest Supabase migrations to enable offers.
                </p>
              )}
            </div>
            <Link
              href="/products"
              className="text-sm font-semibold text-slate-700 transition hover:text-teal-800"
            >
              Open catalog <span aria-hidden="true" className="ml-1">→</span>
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-slate-200 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 5 }, (_, index) => (
                <div
                  key={index}
                  className="aspect-[3/5] animate-pulse bg-white"
                />
              ))}
            </div>
          ) : error ? (
            <div
              role="alert"
              className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center"
            >
              <h3 className="font-semibold text-rose-950">
                We couldn&apos;t load the marketplace
              </h3>
              <p className="mx-auto mt-2 max-w-2xl text-sm text-rose-800">
                {error}
              </p>
              {error.toLowerCase().includes("permission denied") && (
                <p className="mx-auto mt-2 max-w-2xl text-sm text-rose-800">
                  Apply the latest Supabase migration, then try again.
                </p>
              )}
              <button
                type="button"
                onClick={loadStorefront}
                className="mt-4 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              >
                Try again
              </button>
            </div>
          ) : products.length ? (
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-slate-200 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
              <h3 className="text-lg font-semibold">The catalog is getting ready</h3>
              <p className="mt-2 text-sm text-slate-600">
                Approved products will appear here when they are available.
              </p>
            </div>
          )}
        </section>

        <section
          id="about"
          className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 lg:px-8"
        >
          <div className="grid overflow-hidden rounded-[2rem] bg-[#e8eee7] md:grid-cols-2">
            <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-14">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-900">
                More to discover
              </p>
              <h2 className="mt-3 max-w-md text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                Good finds, from more than one point of view.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-slate-700">
                Shopora brings products from marketplace sellers together, so
                you can explore, compare, and choose what works for you.
              </p>
              <Link
                href="/products"
                className="mt-7 inline-flex w-fit rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              >
                Explore Shopora
              </Link>
            </div>
            <div className="relative min-h-64 bg-gradient-to-br from-[#c5d6c9] via-[#dce6d3] to-[#f2e7d2] md:min-h-80">
              {heroProducts[0] && (
                <CatalogImage
                  product={heroProducts[0]}
                  className="object-contain p-8 sm:p-12"
                />
              )}
              <div
                aria-hidden="true"
                className="absolute -bottom-16 -right-10 h-48 w-48 rounded-full border-[34px] border-white/40"
              />
            </div>
          </div>
        </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
