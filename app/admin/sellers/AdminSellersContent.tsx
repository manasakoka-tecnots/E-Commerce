"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";
import Spinner from "@/src/components/Spinner";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Seller = {
  id: string;
  business_name: string;
  business_type: string | null;
  business_address: string | null;
  status: string;
  created_at: string;
  owner_email: string | null;
  products_count: number;
  revenue: number;
};

type StatusFilter = "all" | "approved" | "pending" | "rejected" | "suspended";

const statusTabs: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Approved", value: "approved" },
  { label: "Pending", value: "pending" },
  { label: "Rejected", value: "rejected" },
  { label: "Suspended", value: "suspended" },
];

const formatRupee = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const statusBadge = (status: string) => {
  switch (status) {
    case "approved":
      return "bg-emerald-100 text-emerald-800";
    case "pending":
      return "bg-amber-100 text-amber-800";
    case "rejected":
      return "bg-red-100 text-red-800";
    case "suspended":
      return "bg-gray-200 text-gray-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AdminSellersContent() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);

  const loadSellers = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // Fetch all sellers
      const { data: sellersData, error: sellersError } = await supabase
        .from("sellers")
        .select("id, business_name, business_type, business_address, status, created_at, auth_uid")
        .order("created_at", { ascending: false });

      if (sellersError) {
        setErrorMessage(sellersError.message);
        setLoading(false);
        return;
      }

      // Build seller list with additional info
      const enriched: Seller[] = await Promise.all(
        (sellersData || []).map(async (s) => {
          // Get product count
          const { count: productsCount } = await supabase
            .from("seller_listings")
            .select("id", { count: "exact", head: true })
            .eq("seller_id", s.id);

          // Get email from profiles
          let ownerEmail: string | null = null;
          if (s.auth_uid) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("email")
              .eq("auth_uid", s.auth_uid)
              .maybeSingle();
            ownerEmail = profile?.email ?? null;
          }

          // Get revenue from orders
          const { data: orderData } = await supabase
            .from("order_items")
            .select("subtotal")
            .eq("seller_id", s.id);

          const revenue = (orderData || []).reduce(
            (sum, item) => sum + (Number(item.subtotal) || 0),
            0
          );

          return {
            id: s.id,
            business_name: s.business_name,
            business_type: s.business_type,
            business_address: s.business_address,
            status: s.status,
            created_at: s.created_at,
            owner_email: ownerEmail,
            products_count: productsCount ?? 0,
            revenue,
          };
        })
      );

      setSellers(enriched);
    } catch {
      setErrorMessage("Failed to load sellers.");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSellers();
  }, [loadSellers]);

  const updateSellerStatus = async (sellerId: string, status: "approved" | "rejected" | "suspended") => {
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

    setSellers((prev) =>
      prev.map((s) => (s.id === sellerId ? { ...s, status } : s))
    );
  };

  const filtered = sellers.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        s.business_name.toLowerCase().includes(q) ||
        (s.owner_email?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

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
        <h1 className="text-2xl font-bold text-gray-900">Sellers</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage marketplace sellers and their applications
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
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
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
          placeholder="Search by business name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 w-full sm:w-72 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-200"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Business
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Owner Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Products
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Joined
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No sellers found.
                  </td>
                </tr>
              ) : (
                filtered.map((seller) => (
                  <tr
                    key={seller.id}
                    className="hover:bg-gray-50/60 transition"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {seller.business_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {seller.business_type || "Commercial Merchant"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {seller.owner_email || "--"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusBadge(
                          seller.status
                        )}`}
                      >
                        {seller.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-700">
                      {seller.products_count}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      {formatRupee(seller.revenue)}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(seller.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {seller.status === "pending" && (
                          <>
                            <button
                              disabled={workingId === seller.id}
                              onClick={() =>
                                void updateSellerStatus(seller.id, "approved")
                              }
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                            >
                              Approve
                            </button>
                            <button
                              disabled={workingId === seller.id}
                              onClick={() =>
                                void updateSellerStatus(seller.id, "rejected")
                              }
                              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {seller.status === "approved" && (
                          <button
                            disabled={workingId === seller.id}
                            onClick={() =>
                              void updateSellerStatus(seller.id, "suspended")
                            }
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition"
                          >
                            Suspend
                          </button>
                        )}
                        {(seller.status === "rejected" || seller.status === "suspended") && (
                          <button
                            disabled={workingId === seller.id}
                            onClick={() =>
                              void updateSellerStatus(seller.id, "approved")
                            }
                            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50 transition"
                          >
                            Reinstate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
