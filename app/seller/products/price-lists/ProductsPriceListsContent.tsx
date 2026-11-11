"use client";

export default function ProductsPriceListsContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Price Lists</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage pricing rules for different customer groups.
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
              d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Coming Soon</h2>
        <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
          Set up different pricing for specific customer groups or markets.
        </p>
      </div>
    </div>
  );
}
