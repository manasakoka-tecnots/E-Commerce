"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/src/context/CartContext";
import { useWishlist } from "@/src/context/WishlistContext";
import { useToast } from "@/src/context/ToastContext";
import {
  getProductImageUrl,
  type ProductCardData,
} from "@/src/lib/catalog";
import StarRating from "@/src/components/StarRating";

const formatRupee = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

function isNewProduct(createdAt: string | null): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  const now = new Date();
  const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= 7;
}

export default function ProductCard({ product }: { product: ProductCardData }) {
  const { addItem, updateQuantity, getItemQuantity } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { addToast } = useToast();
  const [imageError, setImageError] = useState(false);
  const wishlisted = isWishlisted(product.id);
  const quantity = getItemQuantity(product.id);
  const isNew = isNewProduct(product.createdAt);
  const imageUrl = imageError
    ? null
    : getProductImageUrl(product.imageStoragePath);
  const displayPrice = product.price ?? product.referencePrice;

  // Calculate discount percentage
  const discountPercent =
    product.price != null &&
    product.referencePrice != null &&
    product.referencePrice > product.price
      ? Math.round(
          ((product.referencePrice - product.price) / product.referencePrice) *
            100
        )
      : 0;

  const handleAdd = () => {
    if (product.price === null || !product.inStock) return;
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      brand: product.brand || undefined,
      image: imageUrl || undefined,
      sellerListingId: product.sellerListingId || undefined,
    });
    addToast(`Added "${product.name.slice(0, 24)}" to cart`);
  };

  return (
    <article className="product-card group relative flex h-full flex-col overflow-hidden bg-white transition duration-200 hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
      {/* Image Section */}
      <Link
        href={`/products/${product.id}`}
        className="relative aspect-[3/4] overflow-hidden bg-[#f5f5f6]"
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.imageAlt || product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            unoptimized
            className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
            onError={() => setImageError(true)}
          />
        ) : (
          <Image
            src="/placeholder-product.svg"
            alt={`Image unavailable for ${product.name}`}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain p-8"
          />
        )}

        {/* Badges - top left */}
        <div className="absolute left-0 top-2 flex flex-col gap-1">
          {isNew && (
            <span className="rounded-r-sm bg-[#ff3f6c] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              New
            </span>
          )}
          {discountPercent >= 10 && (
            <span className="rounded-r-sm bg-[#ff3f6c] px-2 py-0.5 text-[10px] font-bold text-white">
              {discountPercent}% OFF
            </span>
          )}
        </div>

        {/* Rating badge - bottom left (Myntra style) */}
        {product.averageRating != null &&
          product.reviewCount != null &&
          product.reviewCount > 0 && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-sm bg-white/95 px-1.5 py-0.5 text-xs font-bold shadow-sm backdrop-blur">
              <span className="text-slate-900">
                {product.averageRating.toFixed(1)}
              </span>
              <svg
                className="h-3 w-3 text-teal-600"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="border-l border-slate-300 pl-1 text-[10px] font-medium text-slate-500">
                {product.reviewCount > 999
                  ? `${(product.reviewCount / 1000).toFixed(1)}k`
                  : product.reviewCount}
              </span>
            </div>
          )}
      </Link>

      {/* Wishlist Heart - top right */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          const added = toggleWishlist({
            id: product.id,
            name: product.name,
            price: product.price,
            referencePrice: product.referencePrice,
            brand: product.brand || undefined,
            image: imageUrl || undefined,
          });
          addToast(
            added
              ? `Added "${product.name.slice(0, 20)}" to wishlist`
              : `Removed from wishlist`
          );
        }}
        className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-white shadow-md transition hover:scale-110"
        aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
      >
        {wishlisted ? (
          <svg className="h-4 w-4 text-[#ff3f6c]" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg
            className="h-4 w-4 text-slate-400 transition group-hover:text-slate-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
            />
          </svg>
        )}
      </button>

      {/* Product Info */}
      <div className="flex flex-1 flex-col px-3 pb-3 pt-2.5">
        {/* Product Name */}
        <Link href={`/products/${product.id}`} className="block">
          <h3
            className="line-clamp-1 text-[13px] font-bold leading-[1.3] text-slate-800"
            title={product.name}
          >
            {product.name}
          </h3>
        </Link>

        {/* Brand */}
        {product.brand && (
          <p className="mt-0.5 truncate text-[12px] font-normal text-slate-400">
            {product.brand}
          </p>
        )}

        {/* Price Section */}
        <div className="mt-2 flex items-baseline gap-1.5">
          {displayPrice === null ? (
            <span className="text-sm text-slate-400">Price unavailable</span>
          ) : (
            <>
              <span className="text-sm font-bold text-slate-900">
                {formatRupee(displayPrice)}
              </span>
              {product.referencePrice != null &&
                product.price != null &&
                product.referencePrice > product.price && (
                  <>
                    <span className="text-xs text-slate-400 line-through">
                      {formatRupee(product.referencePrice)}
                    </span>
                    <span className="text-xs font-semibold text-[#ff905a]">
                      ({discountPercent}% OFF)
                    </span>
                  </>
                )}
              {product.price === null && product.referencePrice !== null && (
                <span className="text-[10px] text-slate-400">MRP</span>
              )}
            </>
          )}
        </div>

        {/* Add to Cart / Quantity Controls */}
        <div className="mt-auto pt-3">
          {product.inStock && product.price !== null ? (
            quantity === 0 ? (
              <button
                type="button"
                onClick={handleAdd}
                className="flex w-full items-center justify-center gap-1.5 rounded-sm border border-slate-300 py-2 text-xs font-bold uppercase tracking-wider text-[#ff3f6c] transition hover:border-[#ff3f6c]"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                Add to Cart
              </button>
            ) : (
              <div className="flex items-center justify-between rounded-sm border border-[#ff3f6c] px-1 py-1">
                <button
                  type="button"
                  onClick={() => updateQuantity(product.id, quantity - 1)}
                  aria-label={`Decrease ${product.name} quantity`}
                  className="grid h-7 w-7 place-items-center rounded-sm text-sm font-bold text-[#ff3f6c] hover:bg-pink-50"
                >
                  −
                </button>
                <span
                  aria-live="polite"
                  className="min-w-5 text-center text-sm font-bold text-[#ff3f6c]"
                >
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => updateQuantity(product.id, quantity + 1)}
                  aria-label={`Increase ${product.name} quantity`}
                  className="grid h-7 w-7 place-items-center rounded-sm text-sm font-bold text-[#ff3f6c] hover:bg-pink-50"
                >
                  +
                </button>
              </div>
            )
          ) : (
            <p className="py-2 text-center text-xs font-medium text-slate-400">
              {!product.listingDataAvailable
                ? "Coming soon"
                : product.isCatalogSeed
                  ? "No seller yet"
                  : "Out of stock"}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
