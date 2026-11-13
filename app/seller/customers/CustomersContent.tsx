"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/src/lib/supabase/client";
import Spinner from "@/src/components/Spinner";
import Pagination, { usePagination } from "@/src/components/Pagination";
import { useStaff } from "@/src/context/StaffContext";

const formatRupee = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

type Customer = {
  profile_id: string;
  full_name: string;
  email: string;
  order_count: number;
  total_spent: number;
  last_order_date: string;
};

export default function CustomersContent() {
  const { sellerId: staffSellerId } = useStaff();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const CUSTOMERS_PER_PAGE = 8;
  const [currentPage, setCurrentPage] = useState(1);

  const loadCustomers = useCallback(async () => {
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

    // Get all seller listings
    const { data: listings } = await supabase
      .from("seller_listings")
      .select("id")
      .eq("seller_id", resolvedSellerId);

    if (!listings || listings.length === 0) {
      setCustomers([]);
      setLoading(false);
      return;
    }

    const listingIds = listings.map((l) => l.id);

    // Fetch order items with order and profile info
    const { data: orderItems, error: itemsErr } = await supabase
      .from("order_items")
      .select("id, quantity, price_at_purchase, order_id, seller_listing_id, orders(id, profile_id, status, created_at)")
      .in("seller_listing_id", listingIds);

    if (itemsErr) {
      setError(`Could not load customer data: ${itemsErr.message}`);
      setLoading(false);
      return;
    }

    if (!orderItems || orderItems.length === 0) {
      setCustomers([]);
      setLoading(false);
      return;
    }

    // Aggregate by customer profile_id
    const customerMap: Record<
      string,
      { profile_id: string; order_ids: Set<string>; total_spent: number; last_order_date: string }
    > = {};

    for (const item of orderItems) {
      const order = item.orders as unknown as {
        id: string;
        profile_id: string;
        status: string;
        created_at: string;
      } | null;

      if (!order || !order.profile_id) continue;

      const pid = order.profile_id;
      if (!customerMap[pid]) {
        customerMap[pid] = {
          profile_id: pid,
          order_ids: new Set(),
          total_spent: 0,
          last_order_date: order.created_at,
        };
      }

      customerMap[pid].order_ids.add(order.id);
      customerMap[pid].total_spent += Number(item.price_at_purchase) * Number(item.quantity);

      if (order.created_at > customerMap[pid].last_order_date) {
        customerMap[pid].last_order_date = order.created_at;
      }
    }

    // Fetch profile details for all customer profile_ids
    const profileIds = Object.keys(customerMap);
    if (profileIds.length === 0) {
      setCustomers([]);
      setLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", profileIds);

    const profileLookup: Record<string, { full_name: string; email: string }> = {};
    if (profiles) {
      for (const p of profiles) {
        profileLookup[p.id] = {
          full_name: p.full_name || "Unknown Customer",
          email: p.email || "",
        };
      }
    }

    const customerList: Customer[] = Object.values(customerMap)
      .map((c) => ({
        profile_id: c.profile_id,
        full_name: profileLookup[c.profile_id]?.full_name || "Unknown Customer",
        email: profileLookup[c.profile_id]?.email || "",
        order_count: c.order_ids.size,
        total_spent: c.total_spent,
        last_order_date: c.last_order_date,
      }))
      .sort((a, b) => b.total_spent - a.total_spent);

    setCustomers(customerList);
    setLoading(false);
  }, [staffSellerId]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = customers.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  });

  const paginatedCustomers = usePagination(filteredCustomers, currentPage, CUSTOMERS_PER_PAGE);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  return (
    
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">Customers</h1>
              <p className="text-xs text-gray-500 mt-0.5">Customers who have purchased from your store</p>
            </div>
            <Link
              href="/seller/dashboard"
              className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition"
            >
              Back to Dashboard
            </Link>
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
              <Link href="/seller/dashboard" className="text-xs text-indigo-500 font-semibold mt-2 inline-block">
                Return to Dashboard
              </Link>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Customers</span>
                  <p className="mt-1 text-2xl font-black text-gray-900">{customers.length}</p>
                  <p className="text-[11px] text-gray-500 font-medium mt-1">Unique buyers</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Revenue</span>
                  <p className="mt-1 text-2xl font-black text-indigo-500">
                    {formatRupee(customers.reduce((sum, c) => sum + c.total_spent, 0))}
                  </p>
                  <p className="text-[11px] text-gray-500 font-medium mt-1">From all customers</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 col-span-2 lg:col-span-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Avg. Spend</span>
                  <p className="mt-1 text-2xl font-black text-indigo-600">
                    {customers.length > 0
                      ? formatRupee(
                          customers.reduce((sum, c) => sum + c.total_spent, 0) / customers.length
                        )
                      : formatRupee(0)}
                  </p>
                  <p className="text-[11px] text-gray-500 font-medium mt-1">Per customer</p>
                </div>
              </div>

              {/* Search */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search by customer name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-300"
                  />
                </div>
              </div>

              {/* Customers Table */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                {filteredCustomers.length === 0 && customers.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <svg className="w-10 h-10 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-sm font-semibold text-gray-600">No customers yet</p>
                    <p className="text-xs text-gray-400 max-w-sm mx-auto">
                      When customers purchase your products, their information will appear here.
                      Focus on creating great listings to attract your first buyers.
                    </p>
                    <Link
                      href="/seller/dashboard"
                      className="inline-block text-xs font-semibold text-indigo-500 hover:text-indigo-700 mt-2 transition"
                    >
                      Go to Dashboard
                    </Link>
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-gray-500">No customers match &ldquo;{searchQuery}&rdquo;</p>
                    <button
                      onClick={() => setSearchQuery("")}
                      className="text-xs text-indigo-500 font-semibold mt-2"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 uppercase tracking-wider text-[10px]">
                          <th className="text-left py-3 px-4 font-semibold">Customer</th>
                          <th className="text-left py-3 px-4 font-semibold">Email</th>
                          <th className="text-center py-3 px-4 font-semibold">Orders</th>
                          <th className="text-right py-3 px-4 font-semibold">Total Spent</th>
                          <th className="text-left py-3 px-4 font-semibold">Last Order</th>
                          <th className="text-right py-3 px-4 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginatedCustomers.map((c) => (
                          <tr key={c.profile_id} className="hover:bg-gray-50 transition">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 font-bold text-xs flex-shrink-0">
                                  {c.full_name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()
                                    .slice(0, 2)}
                                </div>
                                <span className="font-semibold text-gray-900">{c.full_name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-gray-500">{c.email || "---"}</td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-flex items-center justify-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">
                                {c.order_count}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-gray-900">{formatRupee(c.total_spent)}</td>
                            <td className="py-3 px-4 text-gray-500">
                              {new Date(c.last_order_date).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Link
                                href={`/seller/orders?customer=${c.profile_id}`}
                                className="rounded-lg bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-700 hover:bg-gray-200 transition"
                              >
                                View Orders
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="px-4 pb-4">
                  <Pagination
                    currentPage={currentPage}
                    totalItems={filteredCustomers.length}
                    itemsPerPage={CUSTOMERS_PER_PAGE}
                    onPageChange={setCurrentPage}
                    itemLabel="customers"
                  />
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    
  );
}
