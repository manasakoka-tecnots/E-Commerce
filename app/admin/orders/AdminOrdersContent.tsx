"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";
import Spinner from "@/src/components/Spinner";
import Pagination, { usePagination } from "@/src/components/Pagination";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Order = {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  seller_name: string | null;
};

type StatusFilter = "all" | "pending" | "processing" | "paid" | "delivered" | "cancelled";

const statusTabs: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Processing", value: "processing" },
  { label: "Paid", value: "paid" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

const formatRupee = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const ORDERS_PER_PAGE = 20;

export default function AdminOrdersContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("id, created_at, total_amount, status, profile_id")
        .order("created_at", { ascending: false });

      if (ordersError) {
        setErrorMessage(ordersError.message);
        setLoading(false);
        return;
      }

      // Enrich with customer and seller info
      const enriched: Order[] = await Promise.all(
        (ordersData || []).map(async (o) => {
          // Get customer info
          let customerName: string | null = null;
          let customerEmail: string | null = null;
          if (o.profile_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("id", o.profile_id)
              .maybeSingle();
            customerName = profile?.full_name ?? null;
            customerEmail = profile?.email ?? null;
          }

          // Get first seller from order items via seller_listings
          let sellerName: string | null = null;
          const { data: items } = await supabase
            .from("order_items")
            .select("seller_listing_id")
            .eq("order_id", o.id)
            .limit(1);

          if (items && items.length > 0 && items[0].seller_listing_id) {
            const { data: listing } = await supabase
              .from("seller_listings")
              .select("seller_id")
              .eq("id", items[0].seller_listing_id)
              .maybeSingle();
            if (listing?.seller_id) {
              const { data: seller } = await supabase
                .from("sellers")
                .select("business_name")
                .eq("id", listing.seller_id)
                .maybeSingle();
              sellerName = seller?.business_name ?? null;
            }
          }

          return {
            id: o.id,
            created_at: o.created_at,
            total_amount: o.total_amount,
            status: o.status,
            customer_name: customerName,
            customer_email: customerEmail,
            seller_name: sellerName,
          };
        })
      );

      setOrders(enriched);
    } catch {
      setErrorMessage("Failed to load orders.");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const filtered = useMemo(() => orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        o.id.toLowerCase().includes(q) ||
        (o.customer_name?.toLowerCase().includes(q) ?? false) ||
        (o.customer_email?.toLowerCase().includes(q) ?? false) ||
        (o.seller_name?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  }), [orders, statusFilter, searchQuery]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery]);

  const paginatedOrders = usePagination(filtered, currentPage, ORDERS_PER_PAGE);

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
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-sm text-gray-500 mt-1">
          All platform orders across sellers
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        {/* Status tabs */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 overflow-x-auto">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                statusFilter === tab.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search by order ID, customer, or seller..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 w-full sm:w-80 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-200"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Order #
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Seller
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No orders found.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-gray-50/60 transition"
                  >
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-semibold text-gray-900">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {order.customer_name || "Guest"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {order.customer_email || "--"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {order.seller_name || "--"}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(order.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      {formatRupee(Number(order.total_amount) || 0)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusColor(
                          order.status
                        )}`}
                      >
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={filtered.length}
        itemsPerPage={ORDERS_PER_PAGE}
        onPageChange={setCurrentPage}
        itemLabel="orders"
      />
    </div>
  );
}
