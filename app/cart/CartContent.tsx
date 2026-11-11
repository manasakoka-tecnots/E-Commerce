"use client";

import Link from "next/link";
import Image from "next/image";
import Navbar from "@/src/components/Navbar";
import Footer from "@/src/components/Footer";
import { useCart } from "@/src/context/CartContext";
import Pagination, { usePagination } from "@/src/components/Pagination";

const formatRupee = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

export default function CartContent() {
  const { items, updateQuantity, removeItem, clear, totalItems, totalAmount } = useCart();
  const { currentPage, setCurrentPage, paginatedItems: paginatedCart } = usePagination(items, 8);

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f6] text-slate-900">
      <Navbar />

      <main className="mx-auto w-full max-w-[1100px] px-4 py-5 flex-1">
        {/* Myntra-style step tracker */}
        <div className="mb-6 flex items-center justify-center gap-0 text-xs font-bold uppercase tracking-wider">
          <span className="text-[#20bd99]">Bag</span>
          <span className="mx-3 h-px w-10 bg-slate-300" />
          <span className="text-slate-400">Address</span>
          <span className="mx-3 h-px w-10 bg-slate-300" />
          <span className="text-slate-400">Payment</span>
        </div>

        {items.length === 0 ? (
          <div className="mx-auto max-w-md bg-white p-12 text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center">
              <svg className="h-16 w-16 text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={0.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800">Hey, it feels so light!</h2>
            <p className="mt-1 text-sm text-slate-500">
              There is nothing in your bag. Let&apos;s add some items.
            </p>
            <Link
              href="/products"
              className="mt-6 inline-block border-2 border-[#ff3f6c] px-10 py-3 text-sm font-bold uppercase tracking-wider text-[#ff3f6c] transition hover:bg-[#ff3f6c] hover:text-white"
            >
              Add Items from Wishlist
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: Cart Items */}
            <div className="lg:col-span-8">
              {/* Delivery & Offers strip */}
              <div className="mb-3 flex items-center justify-between bg-white px-4 py-3 text-xs">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21M3.375 14.25h4.875c.621 0 1.125-.504 1.125-1.125v-3.375c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v3.375c0 .621.504 1.125 1.125 1.125zm0 0V7.5A2.25 2.25 0 015.625 5.25h12.75A2.25 2.25 0 0120.625 7.5v6.75" />
                  </svg>
                  <span className="text-slate-600">
                    Deliver to: <span className="font-bold text-slate-800">Bengaluru 560001</span>
                  </span>
                </div>
                <span className="font-bold text-[#ff3f6c]">
                  {totalAmount >= 499 ? "Free Delivery" : "Delivery: ₹49"}
                </span>
              </div>

              {/* Available offers */}
              <div className="mb-3 bg-white px-4 py-3">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-800">
                  <svg className="h-4 w-4 text-[#ff3f6c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
                  Available Offers
                </h3>
                <p className="text-xs text-slate-500">
                  10% Instant Discount on Axis Bank Credit Cards on a min spend of ₹3,500. TCA
                </p>
              </div>

              {/* Cart header */}
              <div className="flex items-center justify-between bg-white border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="h-4 w-4 accent-[#ff3f6c]" />
                  <span className="text-sm font-bold text-slate-800">
                    {totalItems}/{totalItems} ITEMS SELECTED
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={clear}
                    className="text-xs font-bold text-[#ff3f6c] hover:underline"
                  >
                    REMOVE
                  </button>
                </div>
              </div>

              {/* Items */}
              <div className="divide-y divide-slate-100 bg-white">
                {paginatedCart.map(({ product, quantity }) => (
                  <div key={product.variantId ? `${product.id}::${product.variantId}` : product.id} className="flex gap-4 p-4">
                    {/* Thumbnail */}
                    <Link href={`/products/${product.id}`} className="relative h-[110px] w-[80px] shrink-0 overflow-hidden bg-[#f5f5f6]">
                      {product.image ? (
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          sizes="80px"
                          unoptimized
                          className="object-contain p-1"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <span className="text-[10px] text-slate-300">No image</span>
                        </div>
                      )}
                    </Link>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <Link href={`/products/${product.id}`}>
                        <p className="text-sm font-bold text-slate-800 truncate">{product.name}</p>
                        {product.brand && <p className="text-xs text-slate-400 truncate">{product.brand}</p>}
                      </Link>
                      {product.variantTitle && (
                        <p className="mt-0.5 text-xs text-slate-400">{product.variantTitle}</p>
                      )}

                      {/* Price */}
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-sm font-bold text-slate-900">{formatRupee(product.price * quantity)}</span>
                        {quantity > 1 && (
                          <span className="text-xs text-slate-400">{formatRupee(product.price)} x {quantity}</span>
                        )}
                      </div>

                      {/* Quantity & Actions */}
                      <div className="mt-3 flex items-center gap-4">
                        {/* Quantity selector */}
                        <div className="inline-flex items-center rounded border border-slate-300">
                          <button
                            type="button"
                            onClick={() => updateQuantity(product.id, quantity - 1, product.variantId)}
                            disabled={quantity <= 1}
                            className="grid h-7 w-7 place-items-center text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:text-slate-300"
                          >
                            −
                          </button>
                          <span className="min-w-[28px] border-x border-slate-300 py-1 text-center text-xs font-bold text-slate-800">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(product.id, quantity + 1, product.variantId)}
                            className="grid h-7 w-7 place-items-center text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                          >
                            +
                          </button>
                        </div>

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => removeItem(product.id, product.variantId)}
                          className="text-xs font-bold uppercase text-slate-500 hover:text-[#ff3f6c] transition"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {items.length > 8 && (
                <Pagination currentPage={currentPage} totalItems={items.length} itemsPerPage={8} onPageChange={setCurrentPage} />
              )}
            </div>

            {/* Right Column: Price Details (Myntra style) */}
            <div className="lg:col-span-4">
              <div className="sticky top-24 bg-white">
                <h2 className="border-b border-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Price Details ({totalItems} Item{totalItems !== 1 ? "s" : ""})
                </h2>

                <div className="space-y-3 px-4 py-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total MRP</span>
                    <span className="text-slate-800">{formatRupee(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Discount on MRP</span>
                    <span className="text-teal-600">-₹0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Convenience Fee</span>
                    <span className="text-teal-600">
                      <span className="mr-1 text-slate-400 line-through">₹99</span>
                      FREE
                    </span>
                  </div>

                  <div className="border-t border-dashed border-slate-200 pt-3 flex justify-between font-bold">
                    <span className="text-slate-800">Total Amount</span>
                    <span className="text-slate-900">{formatRupee(totalAmount)}</span>
                  </div>
                </div>

                <div className="px-4 pb-4">
                  <Link
                    href="/checkout"
                    className="block w-full bg-[#ff3f6c] py-3.5 text-center text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#e5355f]"
                  >
                    Place Order
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
