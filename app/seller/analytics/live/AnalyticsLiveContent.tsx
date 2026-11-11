"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/src/lib/supabase/client";
import Spinner from "@/src/components/Spinner";

const formatRupee = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

export default function AnalyticsLiveContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ordersToday, setOrdersToday] = useState(0);
  const [revenueToday, setRevenueToday] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const loadLiveData = useCallback(async () => {
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

    const { data: seller } = await supabase
      .from("sellers")
      .select("id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (!seller) {
      setError("Seller account not found.");
      setLoading(false);
      return;
    }

    // Get today's start
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Get listings for this seller
    const { data: listings } = await supabase
      .from("seller_listings")
      .select("id")
      .eq("seller_id", seller.id);

    if (!listings || listings.length === 0) {
      setOrdersToday(0);
      setRevenueToday(0);
      setLoading(false);
      setLastRefresh(new Date());
      return;
    }

    const listingIds = listings.map((l) => l.id);

    const { data: items } = await supabase
      .from("order_items")
      .select("id, quantity, price_at_purchase, order_id, orders(id, status, created_at)")
      .in("seller_listing_id", listingIds)
      .gte("orders.created_at", todayStart.toISOString());

    if (items && items.length > 0) {
      const validItems = items.filter((item) => {
        const order = item.orders as unknown as { status: string; created_at: string } | null;
        return order && order.created_at >= todayStart.toISOString();
      });

      const uniqueOrders = new Set(validItems.map((item) => item.order_id));
      const revenue = validItems.reduce(
        (sum, item) => sum + Number(item.price_at_purchase) * Number(item.quantity),
        0
      );

      setOrdersToday(uniqueOrders.size);
      setRevenueToday(revenue);
    } else {
      setOrdersToday(0);
      setRevenueToday(0);
    }

    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadLiveData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      void loadLiveData();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadLiveData]);

  return (
    
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-400" />
                  </span>
                  Live View
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">
                  Real-time activity on your store
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-gray-400">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
              <button
                onClick={() => void loadLiveData()}
                className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition"
              >
                Refresh
              </button>
              <Link
                href="/seller/analytics"
                className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition"
              >
                Back to Analytics
              </Link>
            </div>
          </div>
        </div>

        <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center p-16">
              <Spinner />
            </div>
          ) : error ? (
            <div className="bg-white rounded-xl border border-red-200 p-6 text-center">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : (
            <>
              {/* Live Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Current Visitors */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400" />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Current Visitors</span>
                  </div>
                  <p className="text-2xl font-black text-gray-900">0</p>
                  <p className="text-[11px] text-gray-400 font-medium mt-1">Browsing your store now</p>
                </div>

                {/* Orders Today */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Orders Today</span>
                  <p className="mt-1 text-2xl font-black text-indigo-600">{ordersToday}</p>
                  <p className="text-[11px] text-indigo-500 font-semibold mt-1">Since midnight</p>
                </div>

                {/* Revenue Today */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Revenue Today</span>
                  <p className="mt-1 text-2xl font-black text-gray-900">{formatRupee(revenueToday)}</p>
                  <p className="text-[11px] text-gray-500 font-medium mt-1">From confirmed orders</p>
                </div>

                {/* Active Carts */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Active Carts</span>
                  <p className="mt-1 text-2xl font-black text-amber-600">0</p>
                  <p className="text-[11px] text-gray-400 font-medium mt-1">With your products</p>
                </div>
              </div>

              {/* Live Activity Feed Placeholder */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Live Activity Feed</h3>
                <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 p-10 text-center space-y-3">
                  <div className="flex justify-center">
                    <div className="relative flex h-5 w-5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-5 w-5 bg-indigo-400" />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-gray-600">Listening for activity...</p>
                  <p className="text-xs text-gray-400 max-w-md mx-auto">
                    This section will display real-time events such as product views, add-to-cart actions, and new orders
                    as they happen. Live data will appear here as your store receives more traffic.
                  </p>
                </div>
              </div>

              {/* Info Banner */}
              <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-5 flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-indigo-800">About Live View</h4>
                  <p className="text-xs text-indigo-600 mt-1">
                    Live View shows real-time data about your store activity. Visitor counts and active cart tracking
                    will become available as your store receives more traffic. Order counts refresh automatically every 30 seconds.
                    For detailed historical analytics, visit the{" "}
                    <Link href="/seller/analytics" className="font-bold underline">Analytics Dashboard</Link>.
                  </p>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    
  );
}
