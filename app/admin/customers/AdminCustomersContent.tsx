"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";
import Spinner from "@/src/components/Spinner";
import Pagination, { usePagination } from "@/src/components/Pagination";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Customer = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
  orders_count: number;
  total_spent: number;
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

const CUSTOMERS_PER_PAGE = 20;

export default function AdminCustomersContent() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, auth_uid, full_name, email, role, created_at")
        .eq("role", "customer")
        .order("created_at", { ascending: false });

      if (profilesError) {
        setErrorMessage(profilesError.message);
        setLoading(false);
        return;
      }

      const enriched: Customer[] = await Promise.all(
        (profiles || []).map(async (p) => {
          // Get order count and total spent
          const { data: orderData } = await supabase
            .from("orders")
            .select("id, total_amount")
            .eq("user_id", p.auth_uid);

          const orders = orderData || [];
          const totalSpent = orders.reduce(
            (sum, o) => sum + (Number(o.total_amount) || 0),
            0
          );

          return {
            id: p.id,
            full_name: p.full_name,
            email: p.email,
            role: p.role,
            created_at: p.created_at,
            orders_count: orders.length,
            total_spent: totalSpent,
          };
        })
      );

      setCustomers(enriched);
    } catch {
      setErrorMessage("Failed to load customers.");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const filtered = useMemo(() => customers.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.full_name?.toLowerCase().includes(q) ?? false) ||
      (c.email?.toLowerCase().includes(q) ?? false)
    );
  }), [customers, searchQuery]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const paginatedCustomers = usePagination(filtered, currentPage, CUSTOMERS_PER_PAGE);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-1">
            {customers.length} registered customers
          </p>
        </div>

        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 w-full sm:w-72 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-200"
        />
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Email
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Orders
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Total Spent
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Joined
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
                    No customers found.
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-gray-50/60 transition"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                          {(customer.full_name || customer.email || "?")
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                        <span className="font-medium text-gray-900">
                          {customer.full_name || "Unnamed"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {customer.email || "--"}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-700">
                      {customer.orders_count}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      {formatRupee(customer.total_spent)}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(customer.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                        Active
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
        itemsPerPage={CUSTOMERS_PER_PAGE}
        onPageChange={setCurrentPage}
        itemLabel="customers"
      />
    </div>
  );
}
