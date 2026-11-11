"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";
import Spinner from "@/src/components/Spinner";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type FinanceMetrics = {
  totalRevenue: number;
  totalCommissions: number;
  totalPayouts: number;
  commissionRate: number;
};

type SellerPayout = {
  id: string;
  business_name: string;
  totalRevenue: number;
  commission: number;
  payout: number;
  status: string;
};

const COMMISSION_RATE = 0.1; // 10% platform commission

const formatRupee = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AdminFinancesContent() {
  const [metrics, setMetrics] = useState<FinanceMetrics | null>(null);
  const [payouts, setPayouts] = useState<SellerPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadFinances = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // Total revenue
      let totalRevenue = 0;
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase
          .from("orders")
          .select("total_amount")
          .range(offset, offset + 999);
        if (error) {
          setErrorMessage(error.message);
          setLoading(false);
          return;
        }
        totalRevenue += data.reduce(
          (sum, o) => sum + (Number(o.total_amount) || 0),
          0
        );
        if (data.length < 1000) break;
      }

      const totalCommissions = totalRevenue * COMMISSION_RATE;
      const totalPayouts = totalRevenue - totalCommissions;

      setMetrics({
        totalRevenue,
        totalCommissions,
        totalPayouts,
        commissionRate: COMMISSION_RATE * 100,
      });

      // Per-seller payout breakdown
      const { data: sellers } = await supabase
        .from("sellers")
        .select("id, business_name, status")
        .eq("status", "approved")
        .order("business_name");

      if (sellers && sellers.length > 0) {
        const sellerPayouts: SellerPayout[] = await Promise.all(
          sellers.map(async (s) => {
            const { data: items } = await supabase
              .from("order_items")
              .select("subtotal")
              .eq("seller_id", s.id);

            const sellerRevenue = (items || []).reduce(
              (sum, item) => sum + (Number(item.subtotal) || 0),
              0
            );

            const commission = sellerRevenue * COMMISSION_RATE;
            const payout = sellerRevenue - commission;

            return {
              id: s.id,
              business_name: s.business_name,
              totalRevenue: sellerRevenue,
              commission,
              payout,
              status: payout > 0 ? "pending" : "no_balance",
            };
          })
        );

        setPayouts(
          sellerPayouts.sort((a, b) => b.totalRevenue - a.totalRevenue)
        );
      }
    } catch {
      setErrorMessage("Failed to load finance data.");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadFinances();
  }, [loadFinances]);

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
        <h1 className="text-2xl font-bold text-gray-900">Finances</h1>
        <p className="text-sm text-gray-500 mt-1">
          Platform revenue, commissions, and seller payouts
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Total Revenue
          </span>
          <p className="mt-1 text-2xl font-black text-gray-900">
            {metrics ? formatRupee(metrics.totalRevenue) : "--"}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">Gross marketplace volume</p>
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Platform Commissions
          </span>
          <p className="mt-1 text-2xl font-black text-emerald-600">
            {metrics ? formatRupee(metrics.totalCommissions) : "--"}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">Platform earnings</p>
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Seller Payouts
          </span>
          <p className="mt-1 text-2xl font-black text-indigo-700">
            {metrics ? formatRupee(metrics.totalPayouts) : "--"}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">Due to sellers</p>
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Commission Rate
          </span>
          <p className="mt-1 text-2xl font-black text-violet-700">
            {metrics ? `${metrics.commissionRate}%` : "--"}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">Per transaction</p>
        </div>
      </div>

      {/* Payout Management Table */}
      <section className="rounded-2xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">
            Seller Payout Breakdown
          </h2>
          <p className="text-xs text-gray-400">
            Revenue and commission split per seller
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Seller
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Revenue
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Commission ({COMMISSION_RATE * 100}%)
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Payout Due
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payouts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No seller payout data available.
                  </td>
                </tr>
              ) : (
                payouts.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-gray-50/60 transition"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {p.business_name}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-700">
                      {formatRupee(p.totalRevenue)}
                    </td>
                    <td className="px-6 py-4 text-right text-emerald-600 font-medium">
                      {formatRupee(p.commission)}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                      {formatRupee(p.payout)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          p.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {p.status === "pending" ? "Pending" : "No Balance"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
