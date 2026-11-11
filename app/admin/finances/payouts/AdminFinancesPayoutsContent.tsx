"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Payout = {
  id: string;
  seller_id: string;
  amount: number;
  status: string;
  payout_method: string | null;
  created_at: string;
  seller_name?: string;
};

const formatRupee = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const statusBadge = (status: string) => {
  switch (status) {
    case "completed":
    case "paid":
      return "bg-emerald-100 text-emerald-800";
    case "processing":
      return "bg-blue-100 text-blue-800";
    case "pending":
      return "bg-amber-100 text-amber-800";
    case "failed":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-600";
  }
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AdminFinancesPayoutsContent() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const loadPayouts = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase
        .from("seller_payouts")
        .select("id, seller_id, amount, status, payout_method, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      // Get seller names
      const sellerIds = [
        ...new Set((data || []).map((p) => p.seller_id)),
      ];

      const sellerMap: Record<string, string> = {};
      if (sellerIds.length > 0) {
        const { data: sellers } = await supabase
          .from("sellers")
          .select("id, business_name")
          .in("id", sellerIds);

        (sellers || []).forEach((s) => {
          sellerMap[s.id] = s.business_name;
        });
      }

      setPayouts(
        (data || []).map((p) => ({
          ...p,
          seller_name: sellerMap[p.seller_id] || "Unknown Seller",
        }))
      );
    } catch {
      setErrorMessage("Failed to load payouts.");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadPayouts();
  }, [loadPayouts]);

  const processPayout = async (id: string) => {
    setWorkingId(id);
    setErrorMessage(null);

    const { error } = await supabase
      .from("seller_payouts")
      .update({ status: "processing" })
      .eq("id", id);

    setWorkingId(null);

    if (error) {
      setErrorMessage(`Failed to process payout: ${error.message}`);
      return;
    }

    setPayouts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "processing" } : p))
    );
  };

  const totalPending = payouts
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const totalProcessed = payouts
    .filter((p) => p.status === "completed" || p.status === "paid")
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payouts</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage seller payout requests and disbursements
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Total Payouts
          </span>
          <p className="mt-1 text-2xl font-black text-gray-900">
            {loading ? "--" : payouts.length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Pending Amount
          </span>
          <p className="mt-1 text-2xl font-black text-amber-600">
            {loading ? "--" : formatRupee(totalPending)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Total Disbursed
          </span>
          <p className="mt-1 text-2xl font-black text-emerald-600">
            {loading ? "--" : formatRupee(totalProcessed)}
          </p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center p-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Seller
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payouts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-gray-900">
                          No payouts yet
                        </p>
                        <p className="text-xs text-gray-500">
                          Seller payout requests will appear here.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  payouts.map((payout) => (
                    <tr
                      key={payout.id}
                      className="hover:bg-gray-50/60 transition"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {payout.seller_name}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900">
                        {formatRupee(Number(payout.amount) || 0)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusBadge(
                            payout.status
                          )}`}
                        >
                          {payout.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 capitalize">
                        {payout.payout_method || "--"}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {new Date(payout.created_at).toLocaleDateString(
                          "en-IN",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {payout.status === "pending" && (
                          <button
                            onClick={() => void processPayout(payout.id)}
                            disabled={workingId === payout.id}
                            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50 transition"
                          >
                            {workingId === payout.id
                              ? "Processing..."
                              : "Process Payout"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
