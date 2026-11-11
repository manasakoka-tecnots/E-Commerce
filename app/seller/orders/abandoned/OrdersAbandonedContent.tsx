"use client";

export default function OrdersAbandonedContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Abandoned Checkouts
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Track and recover incomplete purchases.
        </p>
      </div>

      <div className="bg-gray-50 border-dashed border-2 border-gray-200 rounded-xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50">
          <svg
            className="h-8 w-8 text-indigo-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Coming Soon</h2>
        <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
          View and recover abandoned shopping carts. Send automated recovery
          emails to customers who left items behind during checkout.
        </p>
      </div>
    </div>
  );
}
