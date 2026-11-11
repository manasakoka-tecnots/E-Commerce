"use client";

import { Suspense, useEffect, useState, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/src/components/Navbar";
import { supabase } from "@/src/lib/supabase/client";
import { useCart } from "@/src/context/CartContext";
import { useWishlist } from "@/src/context/WishlistContext";
import { useToast } from "@/src/context/ToastContext";
import Spinner from "@/src/components/Spinner";
import StarRating from "@/src/components/StarRating";
import type { User } from "@supabase/supabase-js";

type SellerOffer = {
  id: string;
  seller_id: string;
  seller_name: string;
  business_type?: string | null;
  price: number;
  stock: number;
  shippingDetails: string | null;
};

type ProductVariant = {
  id: string;
  title: string;
  sku: string | null;
  price: number | null;
  compare_at_price: number | null;
  stock: number;
  image_url: string | null;
  option1_name: string | null;
  option1_value: string | null;
  option2_name: string | null;
  option2_value: string | null;
  option3_name: string | null;
  option3_value: string | null;
  is_available: boolean;
};

type ProductDetail = {
  id: string;
  name: string;
  brand: string | null;
  description: string | null;
  price: number | null;
  referencePrice: number | null;
  modelNumber: string | null;
  specifications: Record<string, unknown> | null;
  category: string | null;
  isCatalogSeed: boolean;
  images: ProductImage[];
  stock: number;
  offers: SellerOffer[];
  variants: ProductVariant[];
};

type ProductVariantQuery = {
  id: string;
  title: string;
  sku: string | null;
  price: number | string | null;
  compare_at_price: number | string | null;
  stock: number | null;
  image_url: string | null;
  option1_name: string | null;
  option1_value: string | null;
  option2_name: string | null;
  option2_value: string | null;
  option3_name: string | null;
  option3_value: string | null;
  is_available: boolean;
};

type ProductQuery = {
  id: string;
  name: string;
  brand: string | null;
  description: string | null;
  model_number: string | null;
  specifications: Record<string, unknown> | null;
  category_id: string | null;
  is_catalog_seed: boolean;
  catalog_reference_price: number | string | null;
  categories:
    | { name: string }
    | { name: string }[]
    | null;
  seller_listings: ProductListingQuery[] | null;
  product_images: ProductImageQuery[] | null;
  product_variants: ProductVariantQuery[] | null;
};

type ProductListingQuery = {
  id: string;
  seller_id: string;
  price: number | string;
  stock: number | null;
  status: string | null;
  shipping_info: unknown;
  sellers:
    | { business_name: string; business_type: string | null }
    | { business_name: string; business_type: string | null }[]
    | null;
};

type ProductImageQuery = {
  storage_path: string;
  alt_text: string | null;
  source_url: string | null;
  license: string | null;
  attribution: string | null;
  is_representative: boolean;
  order: number | null;
};

type ProductImage = {
  url: string;
  alt: string;
  sourceUrl: string | null;
  license: string | null;
  attribution: string | null;
  isRepresentative: boolean;
};

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
};

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profiles: { full_name: string | null } | null;
};

function getErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Failed to load product details.";
}

const formatRupee = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

function ProductDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const productId = resolvedParams.id;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<SellerOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [linkCopied, setLinkCopied] = useState<boolean>(false);

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const { addItem, updateQuantity, getItemQuantity } = useCart();
  const { toggleWishlist } = useWishlist();
  const { addToast } = useToast();

  useEffect(() => {
    let active = true;

    const fetchProduct = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        const { data, error } = await supabase
          .from("products")
          .select(`
            id,
            name,
            brand,
            description,
            model_number,
            specifications,
            category_id,
            is_catalog_seed,
            catalog_reference_price,
            status,
            categories(name),
            seller_listings(
              id,
              price,
              stock,
              status,
              seller_id,
              shipping_info,
              sellers(id, business_name, business_type)
            ),
            product_images(id, storage_path, alt_text, source_url, license, attribution, is_representative, order),
            product_variants(id, title, sku, price, compare_at_price, stock, image_url, option1_name, option1_value, option2_name, option2_value, option3_name, option3_value, is_available)
          `)
          .eq("id", productId)
          .maybeSingle();

        if (!active) return;

        if (error) {
          setErrorMsg(error.message);
          setProduct(null);
          return;
        }

        if (!data) {
          setProduct(null);
          return;
        }

        const productData = data as ProductQuery;
        const rawListings = (productData.seller_listings || []).filter(
          (listing) => listing.status === "active"
        );

        const offers: SellerOffer[] = rawListings.map((listing) => {
          const seller = Array.isArray(listing.sellers)
            ? listing.sellers[0]
            : listing.sellers;
          return {
            id: listing.id,
            seller_id: listing.seller_id,
            seller_name: seller?.business_name || "Marketplace seller",
            business_type: seller?.business_type || null,
            price: Number(listing.price),
            stock: Number(listing.stock ?? 0),
            shippingDetails:
              listing.shipping_info &&
              typeof listing.shipping_info === "object" &&
              !Array.isArray(listing.shipping_info) &&
              "details" in listing.shipping_info &&
              typeof listing.shipping_info.details === "string"
                ? listing.shipping_info.details
                : null,
          };
        });

        // Sort offers by price ascending
        offers.sort((a, b) => a.price - b.price);

        // Map variants
        const variants: ProductVariant[] = (productData.product_variants || [])
          .filter((v) => v.is_available)
          .map((v) => ({
            id: v.id,
            title: v.title,
            sku: v.sku,
            price: v.price !== null ? Number(v.price) : null,
            compare_at_price: v.compare_at_price !== null ? Number(v.compare_at_price) : null,
            stock: Number(v.stock ?? 0),
            image_url: v.image_url,
            option1_name: v.option1_name,
            option1_value: v.option1_value,
            option2_name: v.option2_name,
            option2_value: v.option2_value,
            option3_name: v.option3_name,
            option3_value: v.option3_value,
            is_available: v.is_available,
          }));

        const lowestAvailableOffer =
          offers.find((offer) => offer.stock > 0) ?? offers[0];
        const price = lowestAvailableOffer?.price ?? null;

        // Build image URLs
        const images: ProductImage[] = [];
        if (productData.product_images && productData.product_images.length > 0) {
          const sortedImages = [...productData.product_images].sort(
            (a, b) =>
              Number(b.is_representative) - Number(a.is_representative) ||
              (a.order ?? 0) - (b.order ?? 0)
          );

          for (const img of sortedImages) {
            if (img.storage_path) {
              const p = img.storage_path;
              let url: string;
              if (p.startsWith("http://") || p.startsWith("https://")) {
                url = p;
              } else if (
                p.startsWith("catalog/") ||
                p.startsWith("/catalog/") ||
                p.startsWith("uploads/") ||
                p.startsWith("/uploads/")
              ) {
                url = p.startsWith("/") ? p : `/${p}`;
              } else {
                url = supabase.storage
                  .from("product-images")
                  .getPublicUrl(p).data.publicUrl;
              }
              images.push({
                url,
                alt: img.alt_text || productData.name,
                sourceUrl: img.source_url,
                license: img.license,
                attribution: img.attribution,
                isRepresentative: img.is_representative,
              });
            }
          }
        }

        if (images.length === 0) {
          // Check for locally uploaded images
          try {
            const uploadsRes = await fetch("/api/product-uploads");
            if (uploadsRes.ok) {
              const mapping: Record<string, string> = await uploadsRes.json();
              if (mapping[productData.id]) {
                images.push({
                  url: mapping[productData.id],
                  alt: productData.name,
                  sourceUrl: null,
                  license: null,
                  attribution: null,
                  isRepresentative: false,
                });
              }
            }
          } catch {
            // Ignore
          }
        }

        if (images.length === 0) {
          images.push({
            url: "/placeholder-product.svg",
            alt: `Image unavailable for ${productData.name}`,
            sourceUrl: null,
            license: null,
            attribution: null,
            isRepresentative: false,
          });
        }

        const detail: ProductDetail = {
          id: productData.id,
          name: productData.name,
          brand: productData.brand || null,
          description: productData.description || null,
          price,
          referencePrice:
            productData.is_catalog_seed &&
            productData.catalog_reference_price !== null
              ? Number(productData.catalog_reference_price)
              : null,
          modelNumber: productData.model_number,
          specifications: productData.specifications,
          category: Array.isArray(productData.categories)
            ? productData.categories[0]?.name ?? null
            : productData.categories?.name ?? null,
          isCatalogSeed: productData.is_catalog_seed,
          images,
          stock: lowestAvailableOffer ? lowestAvailableOffer.stock : 0,
          offers,
          variants,
        };

        setProduct(detail);
        setSelectedOffer(lowestAvailableOffer ?? null);
      } catch (err: unknown) {
        setErrorMsg(getErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchProduct();

    return () => {
      active = false;
    };
  }, [productId]);

  // Fetch reviews and auth session
  useEffect(() => {
    let active = true;

    const fetchReviews = async () => {
      setReviewsLoading(true);
      const { data, error } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, profiles(full_name)")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });

      if (active && !error && data) {
        setReviews((data as ReviewRow[]).map((r) => ({
          ...r,
          profiles: Array.isArray(r.profiles) ? r.profiles[0] ?? null : r.profiles,
        })));
      }
      if (active) setReviewsLoading(false);
    };

    const fetchSession = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;
      if (active) setCurrentUser(user);
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("auth_uid", user.id)
          .single();
        if (active && profile) setProfileId(profile.id);
      }
    };

    void fetchReviews();
    void fetchSession();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (active) setCurrentUser(session?.user ?? null);
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("auth_uid", session.user.id)
          .single();
        if (active && profile) setProfileId(profile.id);
      } else {
        if (active) setProfileId(null);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [productId]);

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  const handleSubmitReview = async () => {
    if (!currentUser || !profileId || submittingReview) return;
    setSubmittingReview(true);

    const { error } = await supabase.from("reviews").insert({
      product_id: productId,
      profile_id: profileId,
      rating: reviewRating,
      comment: reviewComment.trim() || null,
    });

    if (!error) {
      // Re-fetch reviews
      const { data } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, profiles(full_name)")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });
      if (data) setReviews((data as ReviewRow[]).map((r) => ({
          ...r,
          profiles: Array.isArray(r.profiles) ? r.profiles[0] ?? null : r.profiles,
        })));
      setReviewComment("");
      setReviewRating(5);
      addToast("Review submitted successfully!");
    } else {
      addToast("Failed to submit review. Please try again.");
    }

    setSubmittingReview(false);
  };

  // Parse variant options (e.g., { Color: ["Red", "Blue"], Size: ["S", "M", "L"] })
  const variantOptions = (() => {
    if (!product || product.variants.length === 0) return [];
    const optionsMap = new Map<string, Set<string>>();
    for (const v of product.variants) {
      if (v.option1_name && v.option1_value) {
        if (!optionsMap.has(v.option1_name)) optionsMap.set(v.option1_name, new Set());
        optionsMap.get(v.option1_name)!.add(v.option1_value);
      }
      if (v.option2_name && v.option2_value) {
        if (!optionsMap.has(v.option2_name)) optionsMap.set(v.option2_name, new Set());
        optionsMap.get(v.option2_name)!.add(v.option2_value);
      }
      if (v.option3_name && v.option3_value) {
        if (!optionsMap.has(v.option3_name)) optionsMap.set(v.option3_name, new Set());
        optionsMap.get(v.option3_name)!.add(v.option3_value);
      }
    }
    return Array.from(optionsMap.entries()).map(([name, values]) => ({
      name,
      values: Array.from(values),
    }));
  })();

  // Auto-select first option values when product loads
  useEffect(() => {
    if (variantOptions.length > 0 && Object.keys(selectedOptions).length === 0) {
      const defaults: Record<string, string> = {};
      for (const opt of variantOptions) {
        defaults[opt.name] = opt.values[0];
      }
      setSelectedOptions(defaults);
    }
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Find matching variant when options change
  useEffect(() => {
    if (!product || product.variants.length === 0) {
      setSelectedVariant(null);
      return;
    }
    const match = product.variants.find((v) => {
      const checks: boolean[] = [];
      if (v.option1_name && selectedOptions[v.option1_name]) {
        checks.push(v.option1_value === selectedOptions[v.option1_name]);
      }
      if (v.option2_name && selectedOptions[v.option2_name]) {
        checks.push(v.option2_value === selectedOptions[v.option2_name]);
      }
      if (v.option3_name && selectedOptions[v.option3_name]) {
        checks.push(v.option3_value === selectedOptions[v.option3_name]);
      }
      return checks.length > 0 && checks.every(Boolean);
    });
    setSelectedVariant(match ?? null);
  }, [selectedOptions, product]);

  // Check if a specific option value is available (in stock) given other selections
  const isOptionValueAvailable = (optionName: string, value: string): boolean => {
    if (!product) return false;
    const testOptions = { ...selectedOptions, [optionName]: value };
    return product.variants.some((v) => {
      let matches = true;
      if (v.option1_name && testOptions[v.option1_name]) {
        matches = matches && v.option1_value === testOptions[v.option1_name];
      }
      if (v.option2_name && testOptions[v.option2_name]) {
        matches = matches && v.option2_value === testOptions[v.option2_name];
      }
      if (v.option3_name && testOptions[v.option3_name]) {
        matches = matches && v.option3_value === testOptions[v.option3_name];
      }
      return matches && v.stock > 0;
    });
  };

  const hasVariants = product ? product.variants.length > 0 : false;
  const variantRequired = hasVariants && variantOptions.length > 0;
  const quantity = product ? getItemQuantity(product.id, selectedVariant?.id) : 0;
  const variantPrice = selectedVariant?.price;
  const currentPrice =
    variantPrice ?? selectedOffer?.price ?? product?.price ?? product?.referencePrice ?? null;
  const variantStock = selectedVariant ? selectedVariant.stock : null;
  const inStock = variantRequired
    ? (selectedVariant ? selectedVariant.stock > 0 : false)
    : selectedOffer ? selectedOffer.stock > 0 : (product?.stock ?? 0) > 0;
  const activeImage = product?.images[activeImageIndex];

  const handleAddToCart = () => {
    if (!product || !inStock || currentPrice === null) return;
    if (variantRequired && !selectedVariant) return;
    const listingId = selectedOffer?.id || product.offers[0]?.id;
    addItem({
      id: product.id,
      name: product.name,
      price: currentPrice,
      brand: product.brand || undefined,
      image: product.images[0].url,
      sellerListingId: listingId || undefined,
      variantId: selectedVariant?.id,
      variantTitle: selectedVariant?.title,
    });
    const variantLabel = selectedVariant ? ` (${selectedVariant.title})` : "";
    addToast(`Added "${product.name.slice(0, 24)}…${variantLabel}" to cart`);
  };

  const handleBuyNow = () => {
    if (!product || !inStock || currentPrice === null) return;
    if (variantRequired && !selectedVariant) return;
    if (quantity === 0) {
      const listingId = selectedOffer?.id || product.offers[0]?.id;
      addItem({
        id: product.id,
        name: product.name,
        price: currentPrice,
        brand: product.brand || undefined,
        image: product.images[0].url,
        sellerListingId: listingId || undefined,
        variantId: selectedVariant?.id,
        variantTitle: selectedVariant?.title,
      });
    }
    router.push("/checkout");
  };

  const handleAddToWishlist = () => {
    if (!product) return;
    const added = toggleWishlist({
      id: product.id,
      name: product.name,
      price: currentPrice,
      referencePrice: product.referencePrice,
      brand: product.brand || undefined,
      image: product.images[0]?.url,
      sellerListingId: selectedOffer?.id || product.offers[0]?.id,
    });
    addToast(added ? `Added "${product.name.slice(0, 24)}…" to wishlist` : `Removed "${product.name.slice(0, 24)}…" from wishlist`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <div className="flex flex-1 items-center justify-center p-16">
          <Spinner />
        </div>
      </div>
    );
  }

  if (errorMsg || !product) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <main className="mx-auto w-full max-w-lg flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="rounded-3xl bg-white p-10 shadow-xs border border-gray-200 space-y-4">
            <h1 className="text-xl font-bold text-gray-900">Product Not Available</h1>
            <p className="text-xs text-gray-500">
              {errorMsg || "The product you requested does not exist or has been removed from the catalog."}
            </p>
            <Link
              href="/products"
              className="inline-block rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
            >
              Browse Catalog
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f6]">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl px-0 sm:px-0 py-4 flex-1 animate-fade-in">
        {/* Breadcrumbs */}
        <nav className="mb-2 flex items-center gap-2 px-4 text-xs text-slate-400">
          <Link href="/" className="transition hover:text-[#ff3f6c]">
            Home
          </Link>
          <span>/</span>
          <Link href="/products" className="transition hover:text-[#ff3f6c]">
            Products
          </Link>
          {product.category && (
            <>
              <span>/</span>
              <Link href={`/products?category=${encodeURIComponent(product.category)}`} className="transition hover:text-[#ff3f6c]">
                {product.category}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="truncate max-w-xs font-medium text-slate-600">{product.name}</span>
        </nav>

        {/* Product Hero Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 bg-white">
          {/* Column 1: Image Gallery — Myntra-style left grid */}
          <div className="lg:col-span-6 animate-slide-in-left">
            {/* Main image + thumbnails in a grid */}
            <div className="flex flex-col-reverse lg:flex-row gap-3 p-4">
              {/* Thumbnail column (vertical on desktop) */}
              {product.images.length > 1 && (
                <div className="scrollbar-hide flex gap-2 overflow-x-auto lg:flex-col lg:overflow-y-auto lg:max-h-[500px]">
                  {product.images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setActiveImageIndex(i);
                        setImageError(false);
                      }}
                      className={`relative h-14 w-14 shrink-0 overflow-hidden rounded border bg-slate-50 p-0.5 transition ${
                        activeImageIndex === i ? "border-[#ff3f6c] ring-1 ring-[#ff3f6c]" : "border-slate-200 hover:border-slate-400"
                      }`}
                    >
                      <Image src={img.url} alt={img.alt} fill unoptimized className="object-contain p-0.5" />
                    </button>
                  ))}
                </div>
              )}

              {/* Main image */}
              <div className="relative flex-1 aspect-[3/4] w-full overflow-hidden rounded bg-[#f5f5f6] flex items-center justify-center">
                <Image
                  src={
                    imageError
                      ? "/placeholder-product.svg"
                      : product.images[activeImageIndex]?.url || "/placeholder-product.svg"
                  }
                  alt={product.images[activeImageIndex]?.alt || product.name}
                  fill
                  priority
                  unoptimized
                  className="object-contain p-8"
                  onError={() => setImageError(true)}
                />
              </div>
            </div>
          </div>

          {/* Column 2: Product Info — Myntra-style right panel */}
          <div className="lg:col-span-6 border-l border-slate-100 px-5 py-6 sm:px-8 animate-slide-in-right">
            <div>
              {/* Title */}
              <h1 className="text-xl font-bold text-slate-900 leading-snug">
                {product.name}
              </h1>

              {/* Brand */}
              {product.brand && (
                <p className="mt-1 text-sm font-normal text-slate-400">{product.brand}</p>
              )}

              {/* Average Rating — Myntra badge style */}
              {reviews.length > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-sm bg-teal-600 px-2 py-0.5 text-xs font-bold text-white">
                    {averageRating.toFixed(1)}
                    <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                  </span>
                  <span className="border-l border-slate-300 pl-2 text-sm font-medium text-slate-500">
                    {reviews.length} Rating{reviews.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}

              {/* Availability */}
              {!variantRequired && (
                <div className="mt-2 text-xs">
                  {inStock ? (
                    <span className="font-semibold text-teal-700">
                      In stock ({selectedOffer ? selectedOffer.stock : product.stock} left)
                    </span>
                  ) : product.offers.length === 0 ? (
                    <span className="font-medium text-slate-500">
                      No seller offer yet
                    </span>
                  ) : (
                    <span className="font-semibold text-[#ff3f6c]">
                      Currently out of stock
                    </span>
                  )}
                </div>
              )}
              {variantRequired && (
                <div className="mt-2 text-xs">
                  <span className="font-medium text-slate-500">
                    {product.variants.length} variants available
                  </span>
                </div>
              )}

              {/* Pricing section — Myntra style */}
              <div className="mt-4 border-t border-b border-slate-100 py-4">
                {currentPrice === null ? (
                  <span className="text-sm text-slate-400">Price unavailable</span>
                ) : (
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900">
                      {formatRupee(currentPrice)}
                    </span>
                    {product.referencePrice !== null && product.referencePrice > currentPrice && (
                      <>
                        <span className="text-lg text-slate-400 line-through">
                          MRP {formatRupee(product.referencePrice)}
                        </span>
                        <span className="text-lg font-bold text-[#ff905a]">
                          ({Math.round(((product.referencePrice - currentPrice) / product.referencePrice) * 100)}% OFF)
                        </span>
                      </>
                    )}
                  </div>
                )}
                <p className="mt-1 text-xs font-semibold text-teal-700">inclusive of all taxes</p>
              </div>

              {/* Variant Selection — Myntra-style size/option selector */}
              {variantRequired && (
                <div className="mt-5 space-y-5">
                  {variantOptions.map((option) => (
                    <div key={option.name}>
                      <h3 className="mb-3 text-sm font-bold text-slate-800 uppercase">
                        Select {option.name}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {option.values.map((value) => {
                          const isSelected = selectedOptions[option.name] === value;
                          const available = isOptionValueAvailable(option.name, value);
                          return (
                            <button
                              key={value}
                              onClick={() => setSelectedOptions((prev) => ({ ...prev, [option.name]: value }))}
                              disabled={!available}
                              className={`relative h-11 min-w-[44px] rounded-full border px-4 text-sm font-semibold transition ${
                                isSelected
                                  ? "border-[#ff3f6c] bg-[#ff3f6c] text-white"
                                  : available
                                    ? "border-slate-300 bg-white text-slate-700 hover:border-[#ff3f6c]"
                                    : "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed line-through"
                              }`}
                            >
                              {value}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {selectedVariant && (
                    <p className="text-xs text-slate-500">
                      {selectedVariant.stock > 0
                        ? <span className="font-semibold text-teal-700">{selectedVariant.stock} left in stock</span>
                        : <span className="font-semibold text-rose-600">Out of stock</span>
                      }
                      {selectedVariant.sku && <span className="ml-2 text-slate-400">SKU: {selectedVariant.sku}</span>}
                    </p>
                  )}
                  {!selectedVariant && Object.keys(selectedOptions).length > 0 && (
                    <p className="text-xs font-medium text-[#ff3f6c]">This combination is not available</p>
                  )}
                </div>
              )}

              {/* Multi-Vendor Seller Selection — Myntra-style */}
              {product.offers.length > 0 && (
                <div className="mt-5">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800 uppercase">
                    <svg className="h-4 w-4 text-[#ff3f6c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
                    Best Offers
                  </h3>
                  <div className="space-y-2">
                    {product.offers.map((offer) => {
                      const isSelected = selectedOffer?.id === offer.id;
                      return (
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          key={offer.id}
                          onClick={() => setSelectedOffer(offer)}
                          className={`flex w-full items-center justify-between rounded border p-3 text-left transition ${
                            isSelected
                              ? "border-[#ff3f6c] bg-pink-50/50"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900">{offer.seller_name}</span>
                              {offer.business_type && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{offer.business_type}</span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                              <span>{offer.stock} in stock</span>
                              {offer.shippingDetails && (
                                <span className="flex items-center gap-1">
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21" /></svg>
                                  {offer.shippingDetails}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0 pl-3">
                            <span className="text-base font-bold text-slate-900">
                              {formatRupee(offer.price)}
                            </span>
                            {isSelected && (
                              <span className="mt-0.5 block text-[10px] font-bold text-[#ff3f6c]">SELECTED</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons — Myntra style */}
              <div className="mt-6 flex items-center gap-3">
                {!inStock ? (
                  <button
                    disabled
                    className="w-full rounded-none border border-slate-200 bg-slate-100 py-4 px-6 text-sm font-bold uppercase tracking-wider text-slate-400 cursor-not-allowed"
                  >
                    {product.offers.length === 0 ? "No Seller Offer" : "Out of Stock"}
                  </button>
                ) : quantity === 0 ? (
                  <>
                    <button
                      onClick={handleAddToCart}
                      className="flex flex-1 items-center justify-center gap-2 bg-[#ff3f6c] py-4 px-6 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#e5355f] active:scale-[0.99]"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                      Add to Cart
                    </button>
                    <button
                      onClick={handleAddToWishlist}
                      className="flex flex-1 items-center justify-center gap-2 border-2 border-slate-300 bg-white py-4 px-6 text-sm font-bold uppercase tracking-wider text-slate-800 transition hover:border-slate-900 active:scale-[0.99]"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
                      Wishlist
                    </button>
                  </>
                ) : (
                  <div className="flex w-full items-center gap-3">
                    <div className="flex flex-1 items-center justify-between bg-[#ff3f6c] py-3 px-5 text-white">
                      <span className="text-xs font-bold uppercase">In Bag{selectedVariant ? ` (${selectedVariant.title})` : ""}</span>
                      <div className="inline-flex items-center gap-4">
                        <button
                          onClick={() => updateQuantity(product.id, quantity - 1, selectedVariant?.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-base font-bold hover:bg-white/30"
                        >
                          −
                        </button>
                        <span className="text-sm font-black min-w-[20px] text-center">{quantity}</span>
                        <button
                          onClick={() => updateQuantity(product.id, quantity + 1, selectedVariant?.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-base font-bold hover:bg-white/30"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={handleBuyNow}
                      className="shrink-0 border-2 border-slate-300 bg-white py-3.5 px-6 text-sm font-bold uppercase tracking-wider text-slate-800 transition hover:border-slate-900"
                    >
                      Buy Now
                    </button>
                  </div>
                )}
              </div>

              {/* Delivery & Returns — Myntra style */}
              <div className="mt-6 space-y-3 border-t border-slate-100 pt-5">
                <h3 className="text-sm font-bold uppercase text-slate-800">Delivery Options</h3>
                <div className="flex items-start gap-3 text-sm text-slate-600">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21M3.375 14.25h4.875c.621 0 1.125-.504 1.125-1.125v-3.375c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v3.375c0 .621.504 1.125 1.125 1.125zm0 0V7.5A2.25 2.25 0 015.625 5.25h12.75A2.25 2.25 0 0120.625 7.5v6.75" /></svg>
                  <div>
                    <p className="font-semibold text-slate-800">Get it by 3-5 business days</p>
                    <p className="text-xs text-slate-400">Free delivery on orders above ₹499</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm text-slate-600">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" /></svg>
                  <div>
                    <p className="font-semibold text-slate-800">Easy 30-day returns</p>
                    <p className="text-xs text-slate-400">Return or exchange within 30 days</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm text-slate-600">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
                  <div>
                    <p className="font-semibold text-slate-800">Cash on Delivery available</p>
                    <p className="text-xs text-slate-400">Pay when your order arrives</p>
                  </div>
                </div>
              </div>

              {/* Share Product */}
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Share this product</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* WhatsApp */}
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Check out ${product.name} on Shopora! ${typeof window !== "undefined" ? window.location.href : ""}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center h-9 w-9 rounded-xl border border-gray-200 bg-white hover:bg-green-50 hover:border-green-300 transition"
                    title="Share on WhatsApp"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-green-600" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </a>

                  {/* Copy Link */}
                  <button
                    onClick={() => {
                      const url = typeof window !== "undefined" ? window.location.href : "";
                      navigator.clipboard.writeText(url).then(() => {
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2000);
                      });
                    }}
                    className="flex items-center justify-center h-9 min-w-[36px] px-2 gap-1 rounded-xl border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-300 transition"
                    title="Copy link"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                    </svg>
                    {linkCopied && <span className="text-[10px] font-semibold text-emerald-600">Copied!</span>}
                  </button>

                  {/* Twitter / X */}
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${product.name} on Shopora!`)}&url=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center h-9 w-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 hover:border-gray-400 transition"
                    title="Share on X"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-gray-800" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </a>

                  {/* Facebook */}
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center h-9 w-9 rounded-xl border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-400 transition"
                    title="Share on Facebook"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-blue-600" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </a>

                  {/* Email */}
                  <a
                    href={`mailto:?subject=${encodeURIComponent(`Check out ${product.name} on Shopora!`)}&body=${encodeURIComponent(`I found this great product on Shopora: ${product.name}\n\n${typeof window !== "undefined" ? window.location.href : ""}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center h-9 w-9 rounded-xl border border-gray-200 bg-white hover:bg-orange-50 hover:border-orange-300 transition"
                    title="Share via Email"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2"/>
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/>
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            {/* Product Details — Myntra-style sections */}
            <div className="mt-6 border-t border-slate-100 pt-5">
              <h2 className="mb-4 text-sm font-bold uppercase text-slate-800">
                Product Details
              </h2>
              {product.description && (
                <p className="mb-4 text-sm leading-relaxed text-slate-600 whitespace-pre-line">
                  {product.description}
                </p>
              )}
              <dl className="grid gap-y-2 gap-x-4 text-sm sm:grid-cols-2">
                {product.category && (
                  <div className="flex gap-2">
                    <dt className="font-medium text-slate-500">Category</dt>
                    <dd className="text-slate-800">{product.category}</dd>
                  </div>
                )}
                {product.modelNumber && (
                  <div className="flex gap-2">
                    <dt className="font-medium text-slate-500">Model</dt>
                    <dd className="text-slate-800">{product.modelNumber}</dd>
                  </div>
                )}
                {Object.entries(product.specifications ?? {}).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <dt className="font-medium text-slate-500 capitalize">
                      {key.replaceAll("_", " ")}
                    </dt>
                    <dd className="text-slate-800">{String(value)}</dd>
                  </div>
                ))}
              </dl>
              {activeImage?.attribution && (
                <p className="mt-4 text-[11px] text-slate-400">
                  Image credit:{" "}
                  {activeImage.sourceUrl ? (
                    <a href={activeImage.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                      {activeImage.attribution}
                    </a>
                  ) : (
                    activeImage.attribution
                  )}
                  {activeImage.license && ` · ${activeImage.license}`}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Reviews Section — Myntra style */}
        <div className="mt-6 bg-white p-6 sm:p-8 border-t border-slate-200">
          <h2 className="text-sm font-bold uppercase text-slate-800 mb-6">
            Ratings &amp; Reviews
            {reviews.length > 0 && (
              <span className="ml-2 text-sm font-normal normal-case text-slate-500">
                ({reviews.length})
              </span>
            )}
          </h2>

          {/* Review Submission Form */}
          {currentUser ? (
            <div className="mb-6 border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-800 mb-3">Write a Review</h3>
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">Your Rating</label>
                <StarRating
                  rating={reviewRating}
                  size="lg"
                  interactive
                  onChange={(r) => setReviewRating(r)}
                />
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">Your Review</label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share your experience with this product..."
                  rows={3}
                  className="w-full border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-[#ff3f6c] focus:ring-1 focus:ring-[#ff3f6c] outline-none transition"
                />
              </div>
              <button
                onClick={handleSubmitReview}
                disabled={submittingReview}
                className="bg-[#ff3f6c] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#e5355f] disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {submittingReview ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          ) : (
            <div className="mb-6 border border-dashed border-slate-300 p-5 text-center">
              <p className="text-sm text-slate-500">
                <Link href="/auth/login" className="font-bold text-[#ff3f6c] hover:underline">
                  Sign in
                </Link>{" "}
                to write a review
              </p>
            </div>
          )}

          {/* Review List */}
          {reviewsLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : reviews.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">
              No reviews yet. Be the first to review this product!
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {reviews.map((review) => (
                <div key={review.id} className="py-4">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-sm bg-teal-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                      {review.rating}
                      <svg className="h-2 w-2" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    </span>
                    {review.comment && (
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {review.comment}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-medium text-slate-600">
                      {review.profiles?.full_name || "Anonymous"}
                    </span>
                    <span>·</span>
                    <span>
                      {new Date(review.created_at).toLocaleDateString("en-IN", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Back navigation */}
        <div className="mt-6 bg-white p-4 text-center border-t border-slate-200">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#ff3f6c] transition hover:underline"
          >
            ← Continue Shopping
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function ProductsidContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col bg-slate-50">
          <Navbar />
          <div className="flex flex-1 items-center justify-center p-16">
            <Spinner />
          </div>
        </div>
      }
    >
      <ProductDetailContent params={params} />
    </Suspense>
  );
}
