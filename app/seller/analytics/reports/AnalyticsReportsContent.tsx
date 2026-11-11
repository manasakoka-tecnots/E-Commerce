"use client";

import { useState } from "react";

const REPORTS = [
  {
    id: "sales",
    title: "Sales Report",
    description:
      "Overview of your sales performance including revenue, order count, and average order value over a selected period.",
    icon: (
      <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
  {
    id: "inventory",
    title: "Inventory Report",
    description:
      "Current stock levels, low-stock alerts, and inventory movement over time for all your products.",
    icon: (
      <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    id: "customers",
    title: "Customer Report",
    description:
      "Customer acquisition, retention metrics, and top customer data to help you understand your buyer base.",
    icon: (
      <svg className="h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
];

export default function AnalyticsReportsContent() {
  const [generating, setGenerating] = useState<string | null>(null);

  const handleGenerate = (reportId: string) => {
    setGenerating(reportId);
    // Simulate generation
    setTimeout(() => {
      setGenerating(null);
      alert(
        "Report generation is coming soon. This feature is under development."
      );
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          Generate and download reports for your store.
        </p>
      </div>

      {/* Available reports */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">
          Available Reports
        </h2>
        {REPORTS.map((report) => (
          <div
            key={report.id}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-start gap-4"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-50">
              {report.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900">
                {report.title}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {report.description}
              </p>
            </div>
            <button
              onClick={() => handleGenerate(report.id)}
              disabled={generating === report.id}
              className="shrink-0 bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
            >
              {generating === report.id ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Generating...
                </span>
              ) : (
                "Generate"
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Custom reports */}
      <div className="bg-gray-50 border-dashed border-2 border-gray-200 rounded-xl p-8 text-center">
        <h2 className="text-lg font-semibold text-gray-900">
          Custom Reports -- Coming Soon
        </h2>
        <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
          Build custom reports with specific date ranges, filters, and metrics
          tailored to your business needs.
        </p>
      </div>
    </div>
  );
}
