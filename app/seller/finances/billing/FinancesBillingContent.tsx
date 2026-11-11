"use client";

export default function FinancesBillingContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing & Invoices</h1>
        <p className="mt-1 text-sm text-gray-500">
          View your billing details and platform commission info.
        </p>
      </div>

      {/* Commission info */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          Platform Commission
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-50">
            <span className="text-xl font-bold text-indigo-500">10%</span>
          </div>
          <div>
            <p className="text-sm text-gray-700">
              A <span className="font-semibold">10% commission</span> is charged
              on each completed order.
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Commission is deducted before payout. GST is applied as applicable.
            </p>
          </div>
        </div>
      </div>

      {/* Payment method */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          Payment Method on File
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">
            Manage your bank account details in{" "}
            <a href="/seller/settings/payments" className="text-indigo-500 hover:underline">
              Payment Settings
            </a>.
          </p>
        </div>
      </div>

      {/* Invoice history */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Invoice History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm text-gray-500">
                  No invoices yet. Invoices will appear here after your first payout period.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Coming soon */}
      <div className="bg-gray-50 border-dashed border-2 border-gray-200 rounded-xl p-8 text-center">
        <h2 className="text-lg font-semibold text-gray-900">
          Detailed Billing -- Coming Soon
        </h2>
        <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
          Detailed commission breakdowns, tax reports, and downloadable invoices
          are coming in a future update.
        </p>
      </div>
    </div>
  );
}
