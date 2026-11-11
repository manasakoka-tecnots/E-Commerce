"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/src/lib/supabase/client";
import Spinner from "@/src/components/Spinner";
import Pagination, { usePagination } from "@/src/components/Pagination";

const formatRupee = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

type Payout = {
  id: string;
  amount: number;
  status: string;
  method: string | null;
  reference: string | null;
  created_at: string;
};

export default function FinancesPayoutsContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);

  const loadPayouts = useCallback(async () => {
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

    const { data: payoutData, error: payoutErr } = await supabase
      .from("seller_payouts")
      .select("id, amount, status, method, reference, created_at")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false });

    if (payoutErr) {
      // Table may not exist yet
      setPayouts([]);
      setLoading(false);
      return;
    }

    if (payoutData) {
      setPayouts(
        payoutData.map((p) => ({
          ...p,
          amount: Number(p.amount),
        }))
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadPayouts();
  }, [loadPayouts]);

  const ITEMS_PER_PAGE = 8;
  const { currentPage, setCurrentPage, paginatedItems: paginatedPayouts } = usePagination(payouts, ITEMS_PER_PAGE);

  const totalPaid = payouts
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);
  const totalPending = payouts
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">Payouts</h1>
              <p className="text-xs text-gray-500 mt-0.5">Complete history of your marketplace payouts</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/seller/finances"
                className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition"
              >
                Back to Finances
              </Link>
              <Link
                href="/seller/dashboard"
                className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition"
              >
                Dashboard
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
              {/* Summary Cards */}
              {payouts.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Payouts</span>
                    <p className="mt-1 text-2xl font-black text-gray-900">{payouts.length}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Paid</span>
                    <p className="mt-1 text-2xl font-black text-indigo-500">{formatRupee(totalPaid)}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Pending Payouts</span>
                    <p className="mt-1 text-2xl font-black text-amber-600">{formatRupee(totalPending)}</p>
                  </div>
                </div>
              )}

              {/* Payouts Table */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Payout History</h3>

                {payouts.length === 0 ? (
                  <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 p-12 text-center space-y-3">
                    <svg className="w-10 h-10 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-sm font-semibold text-gray-600">No payouts yet</p>
                    <p className="text-xs text-gray-400 max-w-sm mx-auto">
                      Earnings from completed orders will appear here. Once your available balance
                      reaches the minimum payout threshold, you can request a withdrawal.
                    </p>
                    <Link
                      href="/seller/finances"
                      className="inline-block text-xs font-semibold text-indigo-500 hover:text-indigo-700 mt-2 transition"
                    >
                      View Finances Overview
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[10px]">
                          <th className="text-left py-3 px-4 font-semibold">Date</th>
                          <th className="text-left py-3 px-4 font-semibold">Amount</th>
                          <th className="text-left py-3 px-4 font-semibold">Status</th>
                          <th className="text-left py-3 px-4 font-semibold">Method</th>
                          <th className="text-left py-3 px-4 font-semibold">Reference</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginatedPayouts.map((p) => (
                          <tr key={p.id} className="hover:bg-gray-50 transition">
                            <td className="py-3 px-4 text-gray-700">
                              {new Date(p.created_at).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td className="py-3 px-4 font-bold text-gray-900">{formatRupee(p.amount)}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${
                                  p.status === "completed"
                                    ? "bg-indigo-100 text-indigo-700"
                                    : p.status === "pending"
                                    ? "bg-amber-100 text-amber-800"
                                    : p.status === "failed"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-gray-600">{p.method || "---"}</td>
                            <td className="py-3 px-4 text-gray-500 font-mono text-[10px]">{p.reference || "---"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <Pagination currentPage={currentPage} totalItems={payouts.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} itemLabel="payouts" />
              </div>
            </>
          )}
        </main>
      </div>
    
  );
}
