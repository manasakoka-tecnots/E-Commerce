"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/src/lib/supabase/client";
import { useStaff } from "@/src/context/StaffContext";
import Spinner from "@/src/components/Spinner";

const formatRupee = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

type DateRange = "7d" | "30d" | "90d" | "custom";

type TopProduct = {
  product_id: string;
  product_name: string;
  total_revenue: number;
  units_sold: number;
};

type CategoryBreakdown = {
  category_name: string;
  total_revenue: number;
  order_count: number;
};

type DailyMetric = {
  date: string;
  revenue: number;
};

export default function AnalyticsContent() {
  const { sellerId: staffSellerId } = useStaff();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("30d");

  // Metrics
  const [totalSales, setTotalSales] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [avgOrderValue, setAvgOrderValue] = useState(0);
  const [unitsSold, setUnitsSold] = useState(0);

  // Charts & tables
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);

  const getRangeDate = useCallback((range: DateRange) => {
    const now = new Date();
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    return start.toISOString();
  }, []);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("Please sign in.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_uid", userData.user.id)
      .maybeSingle();

    if (!profile) {
      setError("Profile not found.");
      setLoading(false);
      return;
    }

    let resolvedSellerId = staffSellerId;
    if (!resolvedSellerId) {
      const { data: seller } = await supabase
        .from("sellers")
        .select("id")
        .eq("profile_id", profile.id)
        .maybeSingle();
      resolvedSellerId = seller?.id ?? null;
    }

    if (!resolvedSellerId) {
      setError("Seller account not found.");
      setLoading(false);
      return;
    }

    const startDate = getRangeDate(dateRange);

    // Fetch order_items for this seller with order info
    const { data: orderItems, error: itemsErr } = await supabase
      .from("order_items")
      .select(`
        id,
        quantity,
        price_at_purchase,
        product_id,
        order_id,
        orders!inner(id, status, created_at),
        seller_listings!inner(seller_id, products(name, category_id, categories(name)))
      `)
      .eq("seller_listings.seller_id", resolvedSellerId)
      .in("orders.status", ["delivered", "confirmed", "shipped"])
      .gte("orders.created_at", startDate);

    if (itemsErr) {
      // Fallback: try simpler query without joins
      const { data: listings } = await supabase
        .from("seller_listings")
        .select("id")
        .eq("seller_id", resolvedSellerId);

      if (!listings || listings.length === 0) {
        setTotalSales(0);
        setTotalOrders(0);
        setAvgOrderValue(0);
        setUnitsSold(0);
        setDailyMetrics([]);
        setTopProducts([]);
        setCategoryBreakdown([]);
        setLoading(false);
        return;
      }

      const listingIds = listings.map((l) => l.id);

      const { data: items } = await supabase
        .from("order_items")
        .select("id, quantity, price_at_purchase, product_id, seller_listing_id, order_id, orders(id, status, created_at)")
        .in("seller_listing_id", listingIds)
        .gte("orders.created_at", startDate);

      if (items && items.length > 0) {
        const validItems = items.filter((item) => {
          const order = item.orders as unknown as { status: string; created_at: string } | null;
          return order && ["delivered", "confirmed", "shipped"].includes(order.status);
        });

        const revenue = validItems.reduce((sum, item) => sum + (Number(item.price_at_purchase) * Number(item.quantity)), 0);
        const units = validItems.reduce((sum, item) => sum + Number(item.quantity), 0);
        const uniqueOrders = new Set(validItems.map((item) => item.order_id));

        setTotalSales(revenue);
        setTotalOrders(uniqueOrders.size);
        setAvgOrderValue(uniqueOrders.size > 0 ? revenue / uniqueOrders.size : 0);
        setUnitsSold(units);
      } else {
        setTotalSales(0);
        setTotalOrders(0);
        setAvgOrderValue(0);
        setUnitsSold(0);
      }

      setDailyMetrics([]);
      setTopProducts([]);
      setCategoryBreakdown([]);
      setLoading(false);
      return;
    }

    if (!orderItems || orderItems.length === 0) {
      setTotalSales(0);
      setTotalOrders(0);
      setAvgOrderValue(0);
      setUnitsSold(0);
      setDailyMetrics([]);
      setTopProducts([]);
      setCategoryBreakdown([]);
      setLoading(false);
      return;
    }

    // Compute metrics
    const revenue = orderItems.reduce(
      (sum, item) => sum + Number(item.price_at_purchase) * Number(item.quantity),
      0
    );
    const units = orderItems.reduce((sum, item) => sum + Number(item.quantity), 0);
    const uniqueOrders = new Set(orderItems.map((item) => item.order_id));

    setTotalSales(revenue);
    setTotalOrders(uniqueOrders.size);
    setAvgOrderValue(uniqueOrders.size > 0 ? revenue / uniqueOrders.size : 0);
    setUnitsSold(units);

    // Daily revenue for chart
    const dailyMap: Record<string, number> = {};
    for (const item of orderItems) {
      const order = item.orders as unknown as { created_at: string };
      const day = order.created_at?.slice(0, 10) || "unknown";
      dailyMap[day] = (dailyMap[day] || 0) + Number(item.price_at_purchase) * Number(item.quantity);
    }
    const sortedDays = Object.entries(dailyMap)
      .map(([date, rev]) => ({ date, revenue: rev }))
      .sort((a, b) => a.date.localeCompare(b.date));
    setDailyMetrics(sortedDays);

    // Top products
    const productMap: Record<string, TopProduct> = {};
    for (const item of orderItems) {
      const listing = item.seller_listings as unknown as { products: { name: string } | null };
      const name = listing?.products?.name || "Unknown Product";
      const pid = item.product_id;
      if (!productMap[pid]) {
        productMap[pid] = { product_id: pid, product_name: name, total_revenue: 0, units_sold: 0 };
      }
      productMap[pid].total_revenue += Number(item.price_at_purchase) * Number(item.quantity);
      productMap[pid].units_sold += Number(item.quantity);
    }
    const topProds = Object.values(productMap)
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 5);
    setTopProducts(topProds);

    // Category breakdown
    const catMap: Record<string, CategoryBreakdown> = {};
    for (const item of orderItems) {
      const listing = item.seller_listings as unknown as {
        products: { categories: { name: string } | null } | null;
      };
      const catName = listing?.products?.categories?.name || "Uncategorized";
      if (!catMap[catName]) {
        catMap[catName] = { category_name: catName, total_revenue: 0, order_count: 0 };
      }
      catMap[catName].total_revenue += Number(item.price_at_purchase) * Number(item.quantity);
      catMap[catName].order_count += 1;
    }
    setCategoryBreakdown(
      Object.values(catMap).sort((a, b) => b.total_revenue - a.total_revenue)
    );

    setLoading(false);
  }, [dateRange, getRangeDate, staffSellerId]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const maxRevenue = dailyMetrics.length > 0 ? Math.max(...dailyMetrics.map((d) => d.revenue)) : 1;

  return (
    
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">Analytics</h1>
              <p className="text-xs text-gray-500 mt-0.5">Track your store performance and sales data</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/seller/analytics/live"
                className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition"
              >
                <span className="inline-block w-2 h-2 rounded-full bg-indigo-400 mr-1.5 animate-pulse" />
                Live View
              </Link>
              <Link
                href="/seller/dashboard"
                className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>

        <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
          {/* Date Range Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">Period:</span>
            {(
              [
                { key: "7d", label: "Last 7 days" },
                { key: "30d", label: "Last 30 days" },
                { key: "90d", label: "Last 90 days" },
              ] as { key: DateRange; label: string }[]
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setDateRange(opt.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  dateRange === opt.key
                    ? "bg-indigo-500 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
            <button
              onClick={() => setDateRange("custom")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                dateRange === "custom"
                  ? "bg-indigo-500 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
              title="Custom date range coming soon"
            >
              Custom
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-16">
              <Spinner />
            </div>
          ) : error ? (
            <div className="bg-white rounded-xl border border-red-200 p-6 text-center">
              <p className="text-sm text-red-600">{error}</p>
              <Link href="/seller/dashboard" className="text-xs text-indigo-500 font-semibold mt-2 inline-block">
                Return to Dashboard
              </Link>
            </div>
          ) : (
            <>
              {/* Key Metrics Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Sales</span>
                  <p className="mt-1 text-2xl font-black text-gray-900">{formatRupee(totalSales)}</p>
                  <p className="text-[11px] text-indigo-500 font-semibold mt-1">Revenue earned</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Orders</span>
                  <p className="mt-1 text-2xl font-black text-indigo-600">{totalOrders}</p>
                  <p className="text-[11px] text-gray-500 font-medium mt-1">Completed orders</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Avg Order Value</span>
                  <p className="mt-1 text-2xl font-black text-gray-900">{formatRupee(avgOrderValue)}</p>
                  <p className="text-[11px] text-gray-500 font-medium mt-1">Per order average</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Units Sold</span>
                  <p className="mt-1 text-2xl font-black text-amber-600">{unitsSold}</p>
                  <p className="text-[11px] text-gray-500 font-medium mt-1">Items shipped</p>
                </div>
              </div>

              {/* Sales Chart (CSS bar chart) */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Sales Over Time</h3>
                {dailyMetrics.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-gray-500">No sales data for this period.</p>
                    <p className="text-xs text-gray-400 mt-1">Sales will appear here as orders are completed.</p>
                  </div>
                ) : (
                  <div className="flex items-end gap-1 h-48 overflow-x-auto pb-2">
                    {dailyMetrics.map((d) => {
                      const heightPct = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0;
                      return (
                        <div key={d.date} className="flex flex-col items-center flex-shrink-0 group" style={{ minWidth: "32px" }}>
                          <div className="relative w-full flex justify-center">
                            <div
                              className="w-6 bg-indigo-400 rounded-t hover:bg-indigo-500 transition-colors cursor-default"
                              style={{ height: `${Math.max(heightPct * 1.6, 4)}px` }}
                              title={`${d.date}: ${formatRupee(d.revenue)}`}
                            />
                            <div className="absolute -top-6 hidden group-hover:block bg-gray-900 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap">
                              {formatRupee(d.revenue)}
                            </div>
                          </div>
                          <span className="text-[9px] text-gray-400 mt-1 rotate-[-45deg] origin-top-left whitespace-nowrap">
                            {d.date.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Selling Products */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <h3 className="text-sm font-bold text-gray-900 mb-4">Top Selling Products</h3>
                  {topProducts.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-8">No product sales data yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-100 text-gray-500 uppercase tracking-wider text-[10px]">
                            <th className="text-left py-2 font-semibold">#</th>
                            <th className="text-left py-2 font-semibold">Product</th>
                            <th className="text-right py-2 font-semibold">Revenue</th>
                            <th className="text-right py-2 font-semibold">Units</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {topProducts.map((p, idx) => (
                            <tr key={p.product_id} className="hover:bg-gray-50 transition">
                              <td className="py-2.5 text-gray-400 font-semibold">{idx + 1}</td>
                              <td className="py-2.5 font-semibold text-gray-900">{p.product_name}</td>
                              <td className="py-2.5 text-right font-bold text-gray-900">{formatRupee(p.total_revenue)}</td>
                              <td className="py-2.5 text-right text-gray-600">{p.units_sold}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Sales by Category */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <h3 className="text-sm font-bold text-gray-900 mb-4">Sales by Category</h3>
                  {categoryBreakdown.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-8">No category data yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {categoryBreakdown.map((cat) => {
                        const pct = totalSales > 0 ? (cat.total_revenue / totalSales) * 100 : 0;
                        return (
                          <div key={cat.category_name}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-gray-700">{cat.category_name}</span>
                              <span className="text-xs font-bold text-gray-900">{formatRupee(cat.total_revenue)}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className="bg-indigo-400 h-2 rounded-full transition-all"
                                style={{ width: `${Math.max(pct, 2)}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-[10px] text-gray-400">{cat.order_count} items sold</span>
                              <span className="text-[10px] text-gray-400">{pct.toFixed(1)}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Traffic/Views Placeholder */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-sm font-bold text-gray-900 mb-2">Traffic & Views</h3>
                <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 p-8 text-center">
                  <div className="text-3xl mb-2 text-gray-300">
                    <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-500">Product view tracking coming soon</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Page views, unique visitors, and conversion rates will be displayed here once analytics tracking is enabled.
                  </p>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    
  );
}
