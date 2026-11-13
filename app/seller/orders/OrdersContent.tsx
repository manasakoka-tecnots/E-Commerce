"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/src/lib/supabase/client";
import Spinner from "@/src/components/Spinner";
import Pagination, { usePagination } from "@/src/components/Pagination";
import { useStaff } from "@/src/context/StaffContext";

type OrderRow = {
  id: string;
  order_id: string;
  order_date: string;
  customer_name: string;
  customer_email: string;
  status: string;
  items_count: number;
  seller_total: number;
  fulfillment_status: "unfulfilled" | "partially_fulfilled" | "fulfilled";
};

const STATUS_TABS = [
  "all",
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-indigo-100 text-indigo-700",
  shipped: "bg-purple-100 text-purple-800",
  in_transit: "bg-indigo-100 text-indigo-700",
  out_for_delivery: "bg-amber-100 text-amber-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  out_for_delivery: "Out for Delivery",
  in_transit: "In Transit",
};

const formatRupee = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export default function OrdersContent() {
  const router = useRouter();
  const { sellerId: staffSellerId, isStaff, isOwner, assignedLocationIds } = useStaff();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const ORDERS_PER_PAGE = 8;
  const [currentPage, setCurrentPage] = useState(1);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    // Step 1: Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setErrorMessage("Please sign in with your seller account.");
      setLoading(false);
      return;
    }

    // Step 2: Resolve seller ID — use staff context or detect via API
    let resolvedSellerId = staffSellerId;
    if (!resolvedSellerId) {
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.access_token) {
        try {
          const res = await fetch("/api/auth/detect-role", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.session.access_token}`,
            },
          });
          const roleData = await res.json();
          resolvedSellerId = roleData.sellerId || null;
        } catch {
          // Fall back to direct query
        }
      }
      if (!resolvedSellerId) {
        const { data: seller } = await supabase
          .from("sellers")
          .select("id")
          .eq("profile_id", userData.user.id)
          .maybeSingle();
        resolvedSellerId = seller?.id ?? null;
      }
    }
    if (!resolvedSellerId) {
      setErrorMessage("Seller account not found.");
      setLoading(false);
      return;
    }

    // Step 4: Get this seller's listing IDs
    const { data: listings, error: listingsError } = await supabase
      .from("seller_listings")
      .select("id")
      .eq("seller_id", resolvedSellerId);

    if (listingsError) {
      setErrorMessage(`Could not load listings: ${listingsError.message}`);
      setLoading(false);
      return;
    }

    if (!listings || listings.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const listingIds = listings.map((l) => l.id);

    // Step 5: Get order_items matching seller's listings, joined with orders and profiles
    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select(
        `
        id,
        order_id,
        seller_listing_id,
        quantity,
        price_at_purchase,
        orders!inner (
          id,
          status,
          total_amount,
          created_at,
          profile_id,
          profiles!inner (
            full_name,
            email
          )
        )
      `
      )
      .in("seller_listing_id", listingIds);

    if (itemsError) {
      setErrorMessage(`Could not load orders: ${itemsError.message}`);
      setLoading(false);
      return;
    }

    if (!orderItems || orderItems.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    // Step 6: Group by order_id to build the orders list
    const orderMap = new Map<
      string,
      {
        order_id: string;
        order_date: string;
        customer_name: string;
        customer_email: string;
        status: string;
        items_count: number;
        seller_total: number;
      }
    >();

    for (const item of orderItems) {
      const order = item.orders as unknown as {
        id: string;
        status: string;
        total_amount: number;
        created_at: string;
        profile_id: string;
        profiles: { full_name: string; email: string } | { full_name: string; email: string }[];
      };

      const profileData = Array.isArray(order.profiles)
        ? order.profiles[0]
        : order.profiles;

      const existing = orderMap.get(item.order_id);
      if (existing) {
        existing.items_count += Number(item.quantity);
        existing.seller_total += Number(item.price_at_purchase) * Number(item.quantity);
      } else {
        orderMap.set(item.order_id, {
          order_id: order.id,
          order_date: order.created_at,
          customer_name: profileData?.full_name || "Unknown",
          customer_email: profileData?.email || "",
          status: order.status,
          items_count: Number(item.quantity),
          seller_total: Number(item.price_at_purchase) * Number(item.quantity),
        });
      }
    }

    // Fetch fulfillment data for all orders in one query (include location_id for staff filtering)
    const orderIds = Array.from(orderMap.keys());
    const { data: fulfillmentData } = await supabase
      .from("fulfillments")
      .select("order_id, status, location_id, fulfillment_items(order_item_id, quantity)")
      .eq("seller_id", resolvedSellerId)
      .in("order_id", orderIds);

    // Staff location filtering: only show orders with fulfillments at staff's assigned locations
    // or unfulfilled orders (which staff at any location can potentially fulfill)
    let staffVisibleOrderIds: Set<string> | null = null;
    if (isStaff && assignedLocationIds.length > 0) {
      staffVisibleOrderIds = new Set<string>();
      const assignedSet = new Set(assignedLocationIds);
      for (const oid of orderIds) {
        const orderFulfs = (fulfillmentData || []).filter((f) => f.order_id === oid && f.status !== "cancelled");
        if (orderFulfs.length === 0) {
          // Unfulfilled order — show to all staff so they can fulfill from their location
          staffVisibleOrderIds.add(oid);
        } else if (orderFulfs.some((f) => f.location_id && assignedSet.has(f.location_id))) {
          // Has fulfillment at one of staff's locations
          staffVisibleOrderIds.add(oid);
        }
      }
      // Remove orders not visible to this staff
      for (const oid of orderIds) {
        if (!staffVisibleOrderIds.has(oid)) orderMap.delete(oid);
      }
    }

    // Compute fulfillment status per order
    const fulfillmentStatusMap = new Map<string, "unfulfilled" | "partially_fulfilled" | "fulfilled">();
    for (const oid of orderIds) {
      const orderInfo = orderMap.get(oid);
      if (!orderInfo) continue;
      const totalQty = orderInfo.items_count;
      const orderFulfillments = (fulfillmentData || []).filter(
        (f) => f.order_id === oid && f.status !== "cancelled"
      );
      const fulfilledQty = orderFulfillments.reduce(
        (s, f) => s + ((f.fulfillment_items as { order_item_id: string; quantity: number }[]) || []).reduce((s2, fi) => s2 + fi.quantity, 0),
        0
      );
      if (fulfilledQty === 0) fulfillmentStatusMap.set(oid, "unfulfilled");
      else if (fulfilledQty >= totalQty) fulfillmentStatusMap.set(oid, "fulfilled");
      else fulfillmentStatusMap.set(oid, "partially_fulfilled");
    }

    // Compute effective order status from fulfillments (DB status may be stale)
    const effectiveStatusMap = new Map<string, string>();
    const statusPriority = ["delivered", "out_for_delivery", "in_transit", "shipped", "pending"];
    const fulfillmentToOrder: Record<string, string> = {
      delivered: "delivered",
      out_for_delivery: "out_for_delivery",
      in_transit: "in_transit",
      shipped: "shipped",
      pending: "processing",
    };
    const orderPriorityList = ["pending", "confirmed", "processing", "shipped", "in_transit", "out_for_delivery", "delivered"];

    for (const oid of orderIds) {
      const orderInfo = orderMap.get(oid);
      if (!orderInfo) continue;
      const orderFulfillments = (fulfillmentData || []).filter(
        (f) => f.order_id === oid && f.status !== "cancelled"
      );
      if (orderFulfillments.length === 0) {
        effectiveStatusMap.set(oid, orderInfo.status);
        continue;
      }
      let lowestIdx = 0;
      for (const f of orderFulfillments) {
        const idx = statusPriority.indexOf(f.status);
        if (idx > lowestIdx) lowestIdx = idx;
      }
      const computed = fulfillmentToOrder[statusPriority[lowestIdx]] || orderInfo.status;
      const dbIdx = orderPriorityList.indexOf(orderInfo.status);
      const computedIdx = orderPriorityList.indexOf(computed);
      effectiveStatusMap.set(oid, computedIdx > dbIdx ? computed : orderInfo.status);
    }

    const rows: OrderRow[] = Array.from(orderMap.values()).map((o) => ({
      id: o.order_id,
      order_id: o.order_id,
      order_date: o.order_date,
      customer_name: o.customer_name,
      customer_email: o.customer_email,
      status: effectiveStatusMap.get(o.order_id) || o.status,
      items_count: o.items_count,
      seller_total: o.seller_total,
      fulfillment_status: fulfillmentStatusMap.get(o.order_id) || "unfulfilled",
    }));

    // Sort by date descending
    rows.sort(
      (a, b) =>
        new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
    );

    setOrders(rows);
    setLoading(false);
  }, [staffSellerId, isStaff, assignedLocationIds]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  // Filtering
  const filteredOrders = orders.filter((order) => {
    // Status filter
    if (activeTab !== "all" && order.status !== activeTab) return false;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesId = order.order_id.toLowerCase().includes(q);
      const matchesName = order.customer_name.toLowerCase().includes(q);
      if (!matchesId && !matchesName) return false;
    }

    // Date range filter
    if (dateFrom) {
      const from = new Date(dateFrom);
      if (new Date(order.order_date) < from) return false;
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (new Date(order.order_date) > to) return false;
    }

    return true;
  });

  const paginatedOrders = usePagination(filteredOrders, currentPage, ORDERS_PER_PAGE);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, dateFrom, dateTo]);

  const statusCounts = orders.reduce<Record<string, number>>(
    (acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    },
    {}
  );

  return (
    
      <div className="min-h-screen flex flex-col bg-slate-50">
        {/* Header */}
        <div className="bg-slate-900 text-white border-b border-slate-800">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-lg font-black text-slate-950 shadow-md">
                S
              </span>
              <div>
                <h1 className="text-lg font-extrabold tracking-tight">
                  Order Management
                </h1>
                <p className="text-xs text-slate-400">
                  Shopora Seller Central
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/seller/orders/drafts"
                className="rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
              >
                Draft Orders
              </Link>
              <Link
                href="/seller/dashboard"
                className="rounded-lg border border-slate-600 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>

        <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 flex-1">
          {loading ? (
            <div className="flex items-center justify-center p-16">
              <Spinner />
            </div>
          ) : errorMessage ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center max-w-lg mx-auto space-y-3">
              <h2 className="text-sm font-bold text-red-800">Error</h2>
              <p className="text-xs text-red-600">{errorMessage}</p>
              <Link
                href="/seller/dashboard"
                className="inline-block rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition"
              >
                Go to Dashboard
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Total Orders
                  </span>
                  <p className="mt-1 text-2xl font-black text-gray-900">
                    {orders.length}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Pending
                  </span>
                  <p className="mt-1 text-2xl font-black text-yellow-600">
                    {statusCounts["pending"] || 0}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Processing
                  </span>
                  <p className="mt-1 text-2xl font-black text-indigo-500">
                    {(statusCounts["confirmed"] || 0) +
                      (statusCounts["processing"] || 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Delivered
                  </span>
                  <p className="mt-1 text-2xl font-black text-green-600">
                    {statusCounts["delivered"] || 0}
                  </p>
                </div>
              </div>

              {/* Filters */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                {/* Status Tabs */}
                <div className="flex flex-wrap gap-1 px-4 pt-4 pb-3 border-b border-gray-100">
                  {STATUS_TABS.map((tab) => {
                    const count =
                      tab === "all"
                        ? orders.length
                        : statusCounts[tab] || 0;
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                          activeTab === tab
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {tab === "all" ? "All" : (STATUS_LABELS[tab] || tab)}{" "}
                        <span className="ml-1 opacity-70">({count})</span>
                      </button>
                    );
                  })}
                </div>

                {/* Search & Date Filters */}
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-100">
                  <div className="flex-1 min-w-[200px]">
                    <input
                      type="text"
                      placeholder="Search by Order ID or Customer Name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300/30"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-gray-500">
                      From
                    </label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="rounded-lg border border-gray-300 px-2.5 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300/30"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-gray-500">
                      To
                    </label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="rounded-lg border border-gray-300 px-2.5 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300/30"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setDateFrom("");
                      setDateTo("");
                      setActiveTab("all");
                    }}
                    className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-200 transition"
                  >
                    Clear Filters
                  </button>
                  <button
                    onClick={() => {
                      /* placeholder export */
                      alert(
                        "Export functionality coming soon. Orders will be exported as CSV."
                      );
                    }}
                    className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition"
                  >
                    Export
                  </button>
                </div>

                {/* Orders Table */}
                {filteredOrders.length === 0 ? (
                  <div className="p-12 text-center">
                    <h4 className="text-sm font-bold text-gray-900">
                      No orders found
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {orders.length === 0
                        ? "You haven't received any orders yet. Orders will appear here once customers purchase your products."
                        : "No orders match your current filters. Try adjusting your search or date range."}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold border-b border-gray-200">
                        <tr>
                          <th className="py-3 px-4">Order #</th>
                          <th className="py-3 px-4">Customer</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Items</th>
                          <th className="py-3 px-4">Total</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Fulfillment</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginatedOrders.map((order) => (
                          <tr
                            key={order.id}
                            onClick={() =>
                              router.push(`/seller/orders/${order.id}`)
                            }
                            className="hover:bg-gray-50/70 transition cursor-pointer"
                          >
                            <td className="py-3.5 px-4 font-bold text-indigo-600">
                              #{order.order_id.slice(0, 8).toUpperCase()}
                            </td>
                            <td className="py-3.5 px-4">
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {order.customer_name}
                                </p>
                                <p className="text-gray-400 text-[10px]">
                                  {order.customer_email}
                                </p>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-gray-600">
                              {formatDate(order.order_date)}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-gray-700">
                              {order.items_count}{" "}
                              {order.items_count === 1 ? "item" : "items"}
                            </td>
                            <td className="py-3.5 px-4 font-extrabold text-gray-900">
                              {formatRupee(order.seller_total)}
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                                  STATUS_COLORS[order.status] ||
                                  "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {STATUS_LABELS[order.status] || order.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                  order.fulfillment_status === "fulfilled"
                                    ? "bg-green-100 text-green-700"
                                    : order.fulfillment_status === "partially_fulfilled"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-gray-100 text-gray-500"
                                }`}
                              >
                                {order.fulfillment_status === "fulfilled"
                                  ? "Fulfilled"
                                  : order.fulfillment_status === "partially_fulfilled"
                                  ? "Partial"
                                  : "Unfulfilled"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <Link
                                href={`/seller/orders/${order.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded-lg bg-indigo-50 px-3 py-1.5 text-[10px] font-semibold text-indigo-600 hover:bg-indigo-100 transition"
                              >
                                View Details
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
                    totalItems={filteredOrders.length}
                    itemsPerPage={ORDERS_PER_PAGE}
                    onPageChange={setCurrentPage}
                    itemLabel="orders"
                  />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    
  );
}
