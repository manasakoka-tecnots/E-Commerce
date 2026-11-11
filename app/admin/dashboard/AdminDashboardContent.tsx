"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";
import Spinner from "@/src/components/Spinner";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SellerApplication = {
  id: string;
  business_name: string;
  business_type: string | null;
  business_address: string | null;
  created_at: string;
};

type PlatformStats = {
  totalSellers: number;
  pendingSellers: number;
  totalProducts: number;
  totalOrders: number;
  totalSales: number;
  todayRevenue: number;
  todayOrders: number;
  totalCustomers: number;
};

type RecentOrder = {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
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

export default function AdminDashboardContent() {
  const [applications, setApplications] = useState<SellerApplication[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [pendingApplicationsCount, setPendingApplicationsCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // Get today's date range
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();

      const [
        sellersCount,
        pendingCount,
        productsCount,
        ordersCount,
        customersCount,
        todayOrdersResult,
      ] = await Promise.all([
        supabase.from("sellers").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("sellers").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer"),
        supabase.from("orders").select("id, total_amount").gte("created_at", todayISO),
      ]);

      const countError =
        sellersCount.error ?? pendingCount.error ?? productsCount.error ??
        ordersCount.error ?? customersCount.error ?? todayOrdersResult.error;

      if (countError) {
        setErrorMessage(`Could not load platform totals: ${countError.message}`);
        setLoading(false);
        return;
      }

      // Today's revenue
      const todayRevenue = (todayOrdersResult.data || []).reduce(
        (sum, o) => sum + (Number(o.total_amount) || 0),
        0
      );

      // Pending seller applications
      const appsData: SellerApplication[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase
          .from("sellers")
          .select("id, business_name, business_type, business_address, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .range(offset, offset + 999);
        if (error) {
          setErrorMessage(`Could not load seller applications: ${error.message}`);
          setLoading(false);
          return;
        }
        appsData.push(...data);
        if (data.length < 1000) break;
      }

      // Total revenue
      let totalRevenue = 0;
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase
          .from("orders")
          .select("total_amount")
          .range(offset, offset + 999);
        if (error) {
          setErrorMessage(`Could not load order totals: ${error.message}`);
          setLoading(false);
          return;
        }
        totalRevenue += data.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
        if (data.length < 1000) break;
      }

      // Recent orders
      const { data: recentData } = await supabase
        .from("orders")
        .select("id, created_at, total_amount, status")
        .order("created_at", { ascending: false })
        .limit(5);

      setStats({
        totalSellers: sellersCount.count ?? 0,
        pendingSellers: pendingCount.count ?? 0,
        totalProducts: productsCount.count ?? 0,
        totalOrders: ordersCount.count ?? 0,
        totalSales: totalRevenue,
        todayRevenue,
        todayOrders: (todayOrdersResult.data || []).length,
        totalCustomers: customersCount.count ?? 0,
      });
      setApplications(appsData);
      setPendingApplicationsCount(pendingCount.count ?? 0);
      setRecentOrders(recentData || []);
    } catch (err) {
      setErrorMessage("An unexpected error occurred loading dashboard data.");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const updateSellerStatus = async (sellerId: string, status: "approved" | "rejected") => {
    setWorkingId(sellerId);
    setErrorMessage(null);

    const { error } = await supabase
      .from("sellers")
      .update({ status })
      .eq("id", sellerId);

    setWorkingId(null);

    if (error) {
      setErrorMessage(`Failed to update status: ${error.message}`);
      return;
    }

    setApplications((current) => current.filter((app) => app.id !== sellerId));
    setPendingApplicationsCount((count) => count === null ? count : Math.max(0, count - 1));
    setStats((prev) =>
      prev
        ? {
            ...prev,
            totalSellers: prev.totalSellers + (status === "approved" ? 1 : 0),
            pendingSellers: Math.max(0, prev.pendingSellers - 1),
          }
        : prev
    );
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "paid":
      case "delivered":
      case "completed":
        return "bg-emerald-100 text-emerald-800";
      case "pending":
      case "processing":
        return "bg-amber-100 text-amber-800";
      case "cancelled":
      case "refunded":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Overview of your marketplace performance
        </p>
      </div>

      {/* Error feedback */}
      {errorMessage && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Revenue Today
          </span>
          <p className="mt-1 text-2xl font-black text-emerald-600">
            {stats ? formatRupee(stats.todayRevenue) : "--"}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">
            {stats?.todayOrders ?? 0} orders today
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Total GMV
          </span>
          <p className="mt-1 text-2xl font-black text-gray-900">
            {stats ? formatRupee(stats.totalSales) : "--"}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">
            {stats?.totalOrders ?? 0} total orders
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Active Sellers
          </span>
          <p className="mt-1 text-2xl font-black text-indigo-700">
            {stats?.totalSellers ?? "--"}
          </p>
          <p className="text-[10px] text-amber-600 font-semibold mt-1">
            {stats?.pendingSellers ?? 0} pending approval
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Total Products
          </span>
          <p className="mt-1 text-2xl font-black text-violet-700">
            {stats?.totalProducts ?? "--"}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">
            {stats?.totalCustomers ?? 0} customers
          </p>
        </div>
      </div>

      {/* Two-column layout: Pending Sellers + Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Seller Applications */}
        <section className="rounded-2xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                Pending Applications ({pendingApplicationsCount ?? "--"})
              </h2>
              <p className="text-xs text-gray-400">
                Seller applications awaiting review
              </p>
            </div>
            <Link
              href="/admin/sellers"
              className="text-xs font-semibold text-violet-600 hover:text-violet-800"
            >
              View All
            </Link>
          </div>

          {applications.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <h3 className="text-sm font-bold text-gray-900">
                {pendingApplicationsCount === 0
                  ? "All caught up!"
                  : "No applications found"}
              </h3>
              <p className="text-xs text-gray-500">
                {pendingApplicationsCount === 0
                  ? "No seller applications awaiting verification."
                  : "Could not load applications."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {applications.slice(0, 5).map((app) => (
                <div
                  key={app.id}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-gray-50/60 transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-gray-900 truncate">
                        {app.business_name}
                      </h3>
                      <span className="shrink-0 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase">
                        Pending
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {app.business_type || "Commercial Merchant"} &middot;{" "}
                      {new Date(app.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={workingId === app.id}
                      onClick={() => void updateSellerStatus(app.id, "approved")}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                    >
                      {workingId === app.id ? "..." : "Approve"}
                    </button>
                    <button
                      type="button"
                      disabled={workingId === app.id}
                      onClick={() => void updateSellerStatus(app.id, "rejected")}
                      className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
              {applications.length > 5 && (
                <div className="p-3 text-center">
                  <Link
                    href="/admin/sellers"
                    className="text-xs font-semibold text-violet-600 hover:underline"
                  >
                    View all {applications.length} applications
                  </Link>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Recent Orders */}
        <section className="rounded-2xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Recent Orders</h2>
              <p className="text-xs text-gray-400">Latest platform orders</p>
            </div>
            <Link
              href="/admin/orders"
              className="text-xs font-semibold text-violet-600 hover:text-violet-800"
            >
              View All
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-xs text-gray-500">No orders yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="px-6 py-3 flex items-center justify-between hover:bg-gray-50/60 transition"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {new Date(order.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusColor(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      {formatRupee(Number(order.total_amount) || 0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/admin/products"
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition group"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 group-hover:text-violet-700 transition">
                Manage Products
              </h3>
              <p className="text-xs text-gray-500">Catalog & inventory</p>
            </div>
          </div>
        </Link>

        <Link
          href="/admin/sellers"
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition group"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition">
                Manage Sellers
              </h3>
              <p className="text-xs text-gray-500">Approvals & accounts</p>
            </div>
          </div>
        </Link>

        <Link
          href="/admin/analytics"
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition group"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition">
                View Analytics
              </h3>
              <p className="text-xs text-gray-500">Reports & insights</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
