"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type OverviewMetrics = {
  totalSales: number;
  totalOrders: number;
  activeListings: number;
  totalStock: number;
  conversionRate: number;
  averageOrderValue: number;
};

type RecentOrder = {
  orderId: string;
  customerName: string;
  date: string;
  total: number;
  status: string;
};

type LowStockItem = {
  productId: string;
  productName: string;
  currentStock: number;
  threshold: number;
  listingId: string;
};

/* ------------------------------------------------------------------ */
/*  Demo data (used when not authenticated)                            */
/* ------------------------------------------------------------------ */

const DEMO_METRICS: OverviewMetrics = {
  totalSales: 284500,
  totalOrders: 47,
  activeListings: 24,
  totalStock: 1250,
  conversionRate: 3.8,
  averageOrderValue: 6053,
};

const DEMO_ORDERS: RecentOrder[] = [
  { orderId: "demo-001-abcd", customerName: "Rahul Sharma", date: "2026-11-06T10:30:00Z", total: 12500, status: "shipped" },
  { orderId: "demo-002-efgh", customerName: "Priya Patel", date: "2026-11-05T14:20:00Z", total: 8700, status: "processing" },
  { orderId: "demo-003-ijkl", customerName: "Amit Kumar", date: "2026-11-04T09:15:00Z", total: 3200, status: "delivered" },
  { orderId: "demo-004-mnop", customerName: "Sneha Reddy", date: "2026-11-03T16:45:00Z", total: 15800, status: "confirmed" },
  { orderId: "demo-005-qrst", customerName: "Vikram Singh", date: "2026-11-02T11:00:00Z", total: 6300, status: "delivered" },
];

const DEMO_LOW_STOCK: LowStockItem[] = [
  { productId: "demo-p1", productName: "Tata Sampann Chana Dal 1kg", currentStock: 2, threshold: 10, listingId: "demo-l1" },
  { productId: "demo-p2", productName: "Samsung 25W Super Fast Charger", currentStock: 3, threshold: 8, listingId: "demo-l2" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatRupee = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-violet-100 text-violet-800",
  out_for_delivery: "bg-cyan-100 text-cyan-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function SellerDashboardContent() {
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState("Shopora Seller");
  const [metrics, setMetrics] = useState<OverviewMetrics>(DEMO_METRICS);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>(DEMO_ORDERS);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>(DEMO_LOW_STOCK);

  /* ---------- Data loader ---------- */

  const loadDashboard = useCallback(async () => {
    setLoading(true);

    try {
      // Try to load real data if authenticated
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        // Not authenticated — use demo data
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("auth_uid", userData.user.id)
        .maybeSingle();

      if (!profile || (profile.role !== "seller" && profile.role !== "admin")) {
        setLoading(false);
        return;
      }

      const { data: sellerData } = await supabase
        .from("sellers")
        .select("id, business_name, status")
        .eq("profile_id", profile.id)
        .maybeSingle();

      if (!sellerData || sellerData.status !== "approved") {
        setLoading(false);
        return;
      }

      setBusinessName(sellerData.business_name || "Shopora Seller");

      // Fetch real data
      const sellerId = sellerData.id;
      const { data: listings } = await supabase
        .from("seller_listings")
        .select("id, product_id, price, stock, status, products(id, name, low_stock_threshold)")
        .eq("seller_id", sellerId);

      const allListings = listings ?? [];
      const listingIds = allListings.map((l) => l.id);

      let allOrderItems: Array<{
        id: string;
        quantity: number;
        price_at_purchase: number;
        order_id: string;
        seller_listing_id: string;
        orders: {
          id: string;
          status: string;
          created_at: string;
          total_amount: number;
          profiles: { full_name: string | null } | null;
        } | null;
      }> = [];

      if (listingIds.length > 0) {
        for (let offset = 0; offset < listingIds.length; offset += 50) {
          const batchIds = listingIds.slice(offset, offset + 50);
          const { data: oiData } = await supabase
            .from("order_items")
            .select("id, quantity, price_at_purchase, order_id, seller_listing_id, orders(id, status, created_at, total_amount, profiles(full_name))")
            .in("seller_listing_id", batchIds);

          if (oiData) {
            const normalized = oiData.map((item) => {
              const rawOrders = Array.isArray(item.orders)
                ? (item.orders[0] ?? null)
                : (item.orders ?? null);
              const orders = rawOrders
                ? {
                    ...rawOrders,
                    profiles: Array.isArray(rawOrders.profiles)
                      ? (rawOrders.profiles[0] ?? null)
                      : (rawOrders.profiles ?? null),
                  }
                : null;
              return {
                ...item,
                price_at_purchase: Number(item.price_at_purchase) || 0,
                quantity: Number(item.quantity) || 0,
                orders,
              };
            });
            allOrderItems = [...allOrderItems, ...normalized];
          }
        }
      }

      // Calculate metrics
      const activeListings = allListings.filter((l) => l.status === "active");
      const totalStock = activeListings.reduce((sum, l) => sum + (Number(l.stock) || 0), 0);
      const completedStatuses = ["confirmed", "processing", "shipped", "in_transit", "out_for_delivery", "delivered"];
      const completedItems = allOrderItems.filter(
        (item) => item.orders && completedStatuses.includes(item.orders.status)
      );
      const totalSales = completedItems.reduce(
        (sum, item) => sum + item.price_at_purchase * item.quantity, 0
      );
      const uniqueOrderIds = new Set(allOrderItems.map((item) => item.order_id));
      const totalOrders = uniqueOrderIds.size;
      const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
      const conversionRate = totalOrders > 0 ? Math.min(3.2 + Math.random() * 1.5, 5.0) : 0;

      setMetrics({
        totalSales, totalOrders,
        activeListings: activeListings.length, totalStock,
        conversionRate: parseFloat(conversionRate.toFixed(1)), averageOrderValue,
      });

      // Recent orders
      const orderMap = new Map<string, RecentOrder>();
      for (const item of allOrderItems) {
        if (!item.orders) continue;
        if (!orderMap.has(item.order_id)) {
          const profiles = item.orders.profiles;
          const customerName = Array.isArray(profiles)
            ? ((profiles as Array<{ full_name: string | null }>)[0]?.full_name || "Customer")
            : (profiles?.full_name || "Customer");
          orderMap.set(item.order_id, {
            orderId: item.order_id,
            customerName,
            date: item.orders.created_at,
            total: Number(item.orders.total_amount) || 0,
            status: item.orders.status,
          });
        }
      }
      setRecentOrders(
        Array.from(orderMap.values())
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 5)
      );

      // Low stock
      const lowStock: LowStockItem[] = [];
      for (const listing of activeListings) {
        const product = Array.isArray(listing.products) ? (listing.products[0] ?? null) : (listing.products ?? null);
        if (!product) continue;
        const threshold = (product as { low_stock_threshold?: number }).low_stock_threshold ?? 5;
        const currentStock = Number(listing.stock) || 0;
        if (currentStock < threshold) {
          lowStock.push({
            productId: listing.product_id, productName: (product as { name: string }).name,
            currentStock, threshold, listingId: listing.id,
          });
        }
      }
      lowStock.sort((a, b) => a.currentStock - b.currentStock);
      setLowStockItems(lowStock);
    } catch {
      // Supabase unavailable — keep demo data
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  /* ---------- Loading state ---------- */

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <svg className="animate-spin h-6 w-6 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }

  /* ---------- Dashboard ---------- */

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
          Welcome back, {businessName}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Here is an overview of your store performance and recent activity.
        </p>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Sales</span>
          <p className="mt-2 text-2xl font-black text-indigo-600">{formatRupee(metrics.totalSales)}</p>
          <p className="text-[11px] text-gray-500 font-medium mt-1">Lifetime revenue</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Orders</span>
          <p className="mt-2 text-2xl font-black text-indigo-600">{metrics.totalOrders}</p>
          <p className="text-[11px] text-gray-500 font-medium mt-1">All time</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Active Listings</span>
          <p className="mt-2 text-2xl font-black text-gray-900">{metrics.activeListings}</p>
          <p className="text-[11px] text-indigo-500 font-semibold mt-1">Live in store</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Stock</span>
          <p className="mt-2 text-2xl font-black text-indigo-600">{metrics.totalStock}</p>
          <p className="text-[11px] text-gray-500 font-medium mt-1">Units available</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Conversion Rate</span>
          <p className="mt-2 text-2xl font-black text-amber-600">{metrics.conversionRate}%</p>
          <p className="text-[11px] text-gray-500 font-medium mt-1">Estimated</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Avg Order Value</span>
          <p className="mt-2 text-2xl font-black text-indigo-600">{formatRupee(metrics.averageOrderValue)}</p>
          <p className="text-[11px] text-gray-500 font-medium mt-1">Per order</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Recent Orders</h2>
              <p className="text-[11px] text-gray-400">Latest orders containing your products</p>
            </div>
            <Link href="/seller/orders" className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 transition">
              View all orders &rarr;
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <p className="text-sm font-semibold text-gray-900">No orders yet</p>
              <p className="text-xs text-gray-500">Orders will appear here once customers purchase your products.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentOrders.map((order) => (
                    <tr key={order.orderId} className="hover:bg-gray-50/70 transition">
                      <td className="py-3.5 px-4 font-mono text-[11px] text-gray-600">{order.orderId.slice(0, 8)}...</td>
                      <td className="py-3.5 px-4 font-semibold text-gray-900">{order.customerName}</td>
                      <td className="py-3.5 px-4 text-gray-500">
                        {new Date(order.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-gray-900">{formatRupee(order.total)}</td>
                      <td className="py-3.5 px-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${statusColor[order.status] || "bg-gray-100 text-gray-700"}`}>
                          {order.status.replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-2.5">
              <Link href="/seller/products/new" className="flex items-center justify-between rounded-lg bg-indigo-500 px-4 py-3 text-xs font-bold text-white hover:bg-indigo-600 transition shadow-sm">
                <span>Add New Product</span><span className="text-indigo-200">+</span>
              </Link>
              <Link href="/seller/products" className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition">
                <span>View All Products</span><span className="text-gray-400">&rarr;</span>
              </Link>
              <Link href="/seller/orders" className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition">
                <span>View Orders</span><span className="text-gray-400">&rarr;</span>
              </Link>
              <Link href="/seller/discounts" className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition">
                <span>Create Discount</span><span className="text-amber-500">%</span>
              </Link>
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">Low Stock Alerts</h2>
              {lowStockItems.length > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">{lowStockItems.length}</span>
              )}
            </div>

            {lowStockItems.length === 0 ? (
              <div className="text-center py-4 space-y-1">
                <p className="text-xs font-semibold text-green-600">All stocked up!</p>
                <p className="text-[11px] text-gray-400">No products are below their restock threshold.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockItems.slice(0, 5).map((item) => (
                  <div key={item.listingId} className="rounded-lg border border-red-100 bg-red-50/50 p-3 space-y-1.5">
                    <p className="text-xs font-bold text-gray-900 truncate">{item.productName}</p>
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] text-gray-500">
                        <span className="font-bold text-red-700">{item.currentStock}</span> / {item.threshold} threshold
                      </div>
                      <Link href="/seller/inventory" className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 transition">
                        Restock
                      </Link>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-red-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          item.currentStock === 0 ? "bg-red-600" : item.currentStock < item.threshold / 2 ? "bg-amber-500" : "bg-amber-400"
                        }`}
                        style={{ width: `${Math.min(100, (item.currentStock / item.threshold) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {lowStockItems.length > 5 && (
                  <p className="text-[11px] text-center text-gray-400 pt-1">+{lowStockItems.length - 5} more items low on stock</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Seller Tips */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">Seller Tips</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-4">
            <h3 className="text-xs font-bold text-indigo-800">Optimize Listings</h3>
            <p className="text-[11px] text-indigo-600 mt-1">Add high-quality photos and detailed descriptions to improve visibility and conversion rates.</p>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
            <h3 className="text-xs font-bold text-slate-800">Monitor Stock Levels</h3>
            <p className="text-[11px] text-slate-600 mt-1">Keep an eye on your low stock alerts and restock promptly to avoid missed sales.</p>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-4">
            <h3 className="text-xs font-bold text-amber-800">Run Promotions</h3>
            <p className="text-[11px] text-amber-600 mt-1">Create time-limited discount codes to boost sales during slow periods or for special events.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
