"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";
import Spinner from "@/src/components/Spinner";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type PlatformMetrics = {
  totalGMV: number;
  totalOrders: number;
  totalSellers: number;
  totalCustomers: number;
};

type TopSeller = {
  id: string;
  business_name: string;
  revenue: number;
};

type TopProduct = {
  id: string;
  name: string;
  sales: number;
};

type MonthlyRevenue = {
  month: string;
  revenue: number;
};

const formatRupee = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AdminAnalyticsContent() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [topSellers, setTopSellers] = useState<TopSeller[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // Basic counts
      const [sellersRes, customersRes, ordersRes] = await Promise.all([
        supabase.from("sellers").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer"),
        supabase.from("orders").select("id", { count: "exact", head: true }),
      ]);

      // Get all orders for GMV and monthly breakdown
      const { data: allOrders } = await supabase
        .from("orders")
        .select("id, total_amount, created_at")
        .order("created_at", { ascending: true });

      const orders = allOrders || [];
      const totalGMV = orders.reduce(
        (sum, o) => sum + (Number(o.total_amount) || 0),
        0
      );

      // Monthly revenue breakdown (last 6 months)
      const monthMap = new Map<string, number>();
      orders.forEach((o) => {
        const d = new Date(o.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthMap.set(key, (monthMap.get(key) || 0) + (Number(o.total_amount) || 0));
      });

      const sortedMonths = Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([month, revenue]) => {
          const [y, m] = month.split("-");
          const label = new Date(Number(y), Number(m) - 1).toLocaleDateString("en-IN", {
            month: "short",
            year: "2-digit",
          });
          return { month: label, revenue };
        });

      setMonthlyRevenue(sortedMonths);

      setMetrics({
        totalGMV,
        totalOrders: ordersRes.count ?? 0,
        totalSellers: sellersRes.count ?? 0,
        totalCustomers: customersRes.count ?? 0,
      });

      // Top sellers by revenue
      const { data: sellersList } = await supabase
        .from("sellers")
        .select("id, business_name")
        .eq("status", "approved");

      if (sellersList && sellersList.length > 0) {
        const sellerRevenues: TopSeller[] = await Promise.all(
          sellersList.map(async (s) => {
            const { data: items } = await supabase
              .from("order_items")
              .select("subtotal")
              .eq("seller_id", s.id);

            const revenue = (items || []).reduce(
              (sum, item) => sum + (Number(item.subtotal) || 0),
              0
            );
            return { id: s.id, business_name: s.business_name, revenue };
          })
        );

        setTopSellers(
          sellerRevenues.sort((a, b) => b.revenue - a.revenue).slice(0, 5)
        );
      }

      // Top products by sales (order_items count)
      const { data: productsList } = await supabase
        .from("products")
        .select("id, name")
        .eq("status", "approved");

      if (productsList && productsList.length > 0) {
        const productSales: TopProduct[] = await Promise.all(
          productsList.map(async (p) => {
            const { count } = await supabase
              .from("order_items")
              .select("id", { count: "exact", head: true })
              .eq("product_id", p.id);
            return { id: p.id, name: p.name, sales: count ?? 0 };
          })
        );

        setTopProducts(
          productSales.sort((a, b) => b.sales - a.sales).slice(0, 5)
        );
      }
    } catch {
      setErrorMessage("Failed to load analytics data.");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const maxRevenue = Math.max(...monthlyRevenue.map((m) => m.revenue), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">
          Platform performance insights and metrics
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Total GMV
          </span>
          <p className="mt-1 text-2xl font-black text-emerald-600">
            {metrics ? formatRupee(metrics.totalGMV) : "--"}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Total Orders
          </span>
          <p className="mt-1 text-2xl font-black text-gray-900">
            {metrics?.totalOrders ?? "--"}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Active Sellers
          </span>
          <p className="mt-1 text-2xl font-black text-indigo-700">
            {metrics?.totalSellers ?? "--"}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Total Customers
          </span>
          <p className="mt-1 text-2xl font-black text-violet-700">
            {metrics?.totalCustomers ?? "--"}
          </p>
        </div>
      </div>

      {/* Revenue Chart */}
      <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold text-gray-900 mb-4">Monthly Revenue</h2>
        {monthlyRevenue.length === 0 ? (
          <p className="text-xs text-gray-500 py-8 text-center">
            No revenue data available yet.
          </p>
        ) : (
          <div className="flex items-end gap-3 h-48">
            {monthlyRevenue.map((m) => {
              const heightPct = Math.max((m.revenue / maxRevenue) * 100, 4);
              return (
                <div
                  key={m.month}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <span className="text-[10px] font-semibold text-gray-600">
                    {formatRupee(m.revenue)}
                  </span>
                  <div
                    className="w-full rounded-t-md bg-violet-500 transition-all duration-300"
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[10px] text-gray-500 mt-1">
                    {m.month}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Top Sellers & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Sellers */}
        <section className="rounded-2xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">
              Top Sellers by Revenue
            </h2>
          </div>
          {topSellers.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">
              No seller data available.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {topSellers.map((seller, i) => (
                <div
                  key={seller.id}
                  className="px-6 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {seller.business_name}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">
                    {formatRupee(seller.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Top Products */}
        <section className="rounded-2xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">
              Top Products by Sales
            </h2>
          </div>
          {topProducts.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">
              No product data available.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {topProducts.map((product, i) => (
                <div
                  key={product.id}
                  className="px-6 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-900 truncate max-w-48">
                      {product.name}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-gray-700">
                    {product.sales} sold
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
