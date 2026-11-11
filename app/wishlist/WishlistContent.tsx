"use client";

import Link from "next/link";
import Image from "next/image";
import Navbar from "@/src/components/Navbar";
import Footer from "@/src/components/Footer";
import { useWishlist } from "@/src/context/WishlistContext";
import { useCart } from "@/src/context/CartContext";
import { useToast } from "@/src/context/ToastContext";
import Pagination, { usePagination } from "@/src/components/Pagination";

const formatRupee = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

export default function WishlistContent() {
  const { items, removeItem } = useWishlist();
  const { addItem: addToCart, getItemQuantity } = useCart();
  const { addToast } = useToast();
  const { currentPage, setCurrentPage, paginatedItems: paginatedWishlist } = usePagination(items, 8);

  const handleMoveToBag = (item: (typeof items)[number]) => {
    if (item.price === null) return;
    addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      brand: item.brand,
      image: item.image,
      sellerListingId: item.sellerListingId,
    });
    removeItem(item.id);
    addToast(`Moved "${item.name.slice(0, 24)}" to bag`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f6] text-slate-900">
      <Navbar />

      <main className="mx-auto w-full max-w-[1100px] px-4 py-5 flex-1">
        <h1 className="text-sm font-bold uppercase tracking-wider text-slate-800 mb-4">
          My Wishlist <span className="font-normal text-slate-500">{items.length} item{items.length !== 1 ? "s" : ""}</span>
        </h1>

        {items.length === 0 ? (
          <div className="bg-white p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center">
              <svg className="h-12 w-12 text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={0.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800">Your wishlist is empty</h2>
            <p className="mt-1 text-sm text-slate-500">
              Save items that you like to your wishlist. Review them anytime and easily move them to the bag.
            </p>
            <Link
              href="/products"
              className="mt-6 inline-block border-2 border-[#ff3f6c] px-10 py-3 text-sm font-bold uppercase tracking-wider text-[#ff3f6c] transition hover:bg-[#ff3f6c] hover:text-white"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-px bg-slate-200">
            {paginatedWishlist.map((item) => {
              const inBag = getItemQuantity(item.id) > 0;
              const discountPercent =
                item.price != null && item.referencePrice != null && item.referencePrice > item.price
                  ? Math.round(((item.referencePrice - item.price) / item.referencePrice) * 100)
                  : 0;

              return (
                <div key={item.id} className="relative flex flex-col bg-white">
                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => {
                      removeItem(item.id);
                      addToast("Removed from wishlist");
                    }}
                    className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-white shadow transition hover:bg-red-50"
                    aria-label="Remove from wishlist"
                  >
                    <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  {/* Image */}
                  <Link href={`/products/${item.id}`} className="relative aspect-[3/4] overflow-hidden bg-[#f5f5f6]">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        unoptimized
                        className="object-contain p-4"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <span className="text-xs text-slate-300">No image</span>
                      </div>
                    )}
                  </Link>

                  {/* Info */}
                  <div className="flex flex-1 flex-col px-3 pb-3 pt-2.5">
                    <p className="truncate text-[13px] font-bold text-slate-800">{item.name}</p>
                    {item.brand && <p className="mt-0.5 truncate text-[12px] text-slate-400">{item.brand}</p>}

                    <div className="mt-2 flex items-baseline gap-1.5">
                      {item.price !== null ? (
                        <>
                          <span className="text-sm font-bold text-slate-900">{formatRupee(item.price)}</span>
                          {item.referencePrice != null && item.referencePrice > item.price && (
                            <>
                              <span className="text-xs text-slate-400 line-through">{formatRupee(item.referencePrice)}</span>
                              <span className="text-xs font-semibold text-[#ff905a]">({discountPercent}% OFF)</span>
                            </>
                          )}
                        </>
                      ) : (
                        <span className="text-sm text-slate-400">Price unavailable</span>
                      )}
                    </div>

                    {/* Move to Bag button */}
                    <div className="mt-auto pt-3">
                      {item.price !== null ? (
                        inBag ? (
                          <Link
                            href="/cart"
                            className="flex w-full items-center justify-center gap-1.5 border border-teal-500 py-2 text-xs font-bold uppercase tracking-wider text-teal-600 transition hover:bg-teal-50"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <polyline points="6 12 10 16 18 8" />
                            </svg>
                            In Bag
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleMoveToBag(item)}
                            className="flex w-full items-center justify-center gap-1.5 border border-slate-300 py-2 text-xs font-bold uppercase tracking-wider text-[#ff3f6c] transition hover:border-[#ff3f6c]"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                            </svg>
                            Move to Bag
                          </button>
                        )
                      ) : (
                        <p className="py-2 text-center text-xs text-slate-400">Unavailable</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {items.length > 8 && (
            <Pagination currentPage={currentPage} totalItems={items.length} itemsPerPage={8} onPageChange={setCurrentPage} />
          )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
