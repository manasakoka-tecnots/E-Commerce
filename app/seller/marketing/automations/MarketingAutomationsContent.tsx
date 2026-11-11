"use client";



export default function MarketingAutomationsContent() {
  return (
    
      <div className="min-h-screen bg-gray-50 p-6 md:p-10">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-xl border border-gray-200 bg-white p-10 shadow-sm text-center">
            {/* Illustration placeholder */}
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-indigo-50">
              <svg
                className="h-12 w-12 text-indigo-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-1.756 4.388a2.25 2.25 0 01-2.094 1.362H8.85a2.25 2.25 0 01-2.094-1.362L5 14.5m14 0H5"
                />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-gray-900">Marketing Automations</h1>
            <p className="mx-auto mt-3 max-w-md text-sm text-gray-500 leading-relaxed">
              Coming soon! Automated marketing will allow you to set up powerful workflows
              including:
            </p>

            <ul className="mx-auto mt-6 max-w-sm space-y-3 text-left text-sm text-gray-600">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs text-indigo-500">
                  1
                </span>
                <span>
                  <strong className="text-gray-900">Abandoned Cart Emails</strong> - Automatically
                  remind customers about items left in their cart.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs text-indigo-500">
                  2
                </span>
                <span>
                  <strong className="text-gray-900">Welcome Series</strong> - Onboard new customers
                  with a sequence of personalized emails.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs text-indigo-500">
                  3
                </span>
                <span>
                  <strong className="text-gray-900">Win-back Campaigns</strong> - Re-engage
                  customers who haven&apos;t purchased in a while.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs text-indigo-500">
                  4
                </span>
                <span>
                  <strong className="text-gray-900">Post-Purchase Follow-ups</strong> - Request
                  reviews and suggest related products automatically.
                </span>
              </li>
            </ul>

            <div className="mt-8">
              <span className="inline-block rounded-full bg-indigo-100 px-4 py-1.5 text-xs font-medium text-indigo-600">
                Expected Launch: Q1 2027
              </span>
            </div>
          </div>
        </div>
      </div>
    
  );
}
