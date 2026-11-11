"use client";

import Link from "next/link";


export default function OrdersDraftsContent() {
  return (
    
      <div className="min-h-screen flex flex-col bg-slate-50">
        {/* Header */}
        <div className="bg-slate-900 text-white border-b border-slate-800">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-lg font-black text-slate-950 shadow-md">
                S
              </span>
              <div>
                <h1 className="text-lg font-extrabold tracking-tight">
                  Draft Orders
                </h1>
                <p className="text-xs text-slate-400">
                  Shopora Seller Central
                </p>
              </div>
            </div>
            <Link
              href="/seller/orders"
              className="rounded-lg border border-slate-600 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
            >
              Back to All Orders
            </Link>
          </div>
        </div>

        <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 flex-1">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-12 text-center max-w-lg">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50">
                <svg
                  className="h-8 w-8 text-indigo-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                  />
                </svg>
              </div>

              <h2 className="text-lg font-black text-gray-900 mb-2">
                Coming Soon
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Draft Orders will allow you to create orders on behalf of your
                customers.
              </p>
              <p className="text-xs text-gray-400 mb-8 leading-relaxed">
                With draft orders, you can manually create an order, add line
                items and custom discounts, send an invoice to the customer for
                payment, or record payment directly. This is useful for phone
                orders, wholesale transactions, or custom quotes.
              </p>

              <Link
                href="/seller/orders"
                className="inline-block rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition"
              >
                View All Orders
              </Link>
            </div>
          </div>
        </main>
      </div>
    
  );
}
