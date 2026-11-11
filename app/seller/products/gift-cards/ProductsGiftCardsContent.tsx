"use client";

export default function ProductsGiftCardsContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gift Cards</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage gift cards for your store.
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
              d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Coming Soon</h2>
        <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
          Create and manage gift cards for your store. Gift cards can be sold as
          products and redeemed during checkout.
        </p>
      </div>
    </div>
  );
}
