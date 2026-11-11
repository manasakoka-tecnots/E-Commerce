"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SellerCommission = {
  seller_id: string;
  seller_name: string;
  total_sales: number;
  commission: number;
  net_payout: number;
};

const COMMISSION_RATE = 10; // 10% default

const formatRupee = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AdminFinancesCommissionsContent() {
  const [sellerCommissions, setSellerCommissions] = useState<SellerCommission[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [totalCommission, setTotalCommission] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadCommissions = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // Get all sellers
      const { data: sellers, error: sellersError } = await supabase
        .from("sellers")
        .select("id, business_name")
        .eq("status", "approved");

      if (sellersError) {
        setErrorMessage(sellersError.message);
        setLoading(false);
        return;
      }

      // Calculate sales per seller from order_items
      const commissions: SellerCommission[] = await Promise.all(
        (sellers || []).map(async (seller) => {
          const { data: items } = await supabase
            .from("order_items")
            .select("subtotal")
            .eq("seller_id", seller.id);

          const sales = (items || []).reduce(
            (sum, item) => sum + (Number(item.subtotal) || 0),
            0
          );

          const commission = (sales * COMMISSION_RATE) / 100;

          return {
            seller_id: seller.id,
            seller_name: seller.business_name,
            total_sales: sales,
            commission,
            net_payout: sales - commission,
          };
        })
      );

      // Sort by total sales descending
      commissions.sort((a, b) => b.total_sales - a.total_sales);

      const sumSales = commissions.reduce((s, c) => s + c.total_sales, 0);
      const sumCommission = commissions.reduce((s, c) => s + c.commission, 0);

      setSellerCommissions(commissions);
      setTotalSales(sumSales);
      setTotalCommission(sumCommission);
    } catch {
      setErrorMessage("Failed to load commission data.");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadCommissions();
  }, [loadCommissions]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Commissions</h1>
        <p className="text-sm text-gray-500 mt-1">
          Platform commission overview and seller breakdown
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Commission Rate
          </span>
          <p className="mt-1 text-2xl font-black text-indigo-700">
            {COMMISSION_RATE}%
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Total GMV
          </span>
          <p className="mt-1 text-2xl font-black text-gray-900">
            {loading ? "--" : formatRupee(totalSales)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Total Commissions
          </span>
          <p className="mt-1 text-2xl font-black text-emerald-600">
            {loading ? "--" : formatRupee(totalCommission)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Seller Payable
          </span>
          <p className="mt-1 text-2xl font-black text-violet-700">
            {loading ? "--" : formatRupee(totalSales - totalCommission)}
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
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">
              Commission Breakdown by Seller
            </h2>
            <p className="text-xs text-gray-500">
              Based on {COMMISSION_RATE}% platform commission on all seller sales
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
                    Total Sales
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Commission ({COMMISSION_RATE}%)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Net Payout
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sellerCommissions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-gray-900">
                          No commission data
                        </p>
                        <p className="text-xs text-gray-500">
                          Commission data will appear once sellers start making
                          sales.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {sellerCommissions.map((sc) => (
                      <tr
                        key={sc.seller_id}
                        className="hover:bg-gray-50/60 transition"
                      >
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {sc.seller_name}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-700">
                          {formatRupee(sc.total_sales)}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-emerald-700">
                          {formatRupee(sc.commission)}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-900">
                          {formatRupee(sc.net_payout)}
                        </td>
                      </tr>
                    ))}

                    {/* Totals row */}
                    <tr className="bg-gray-50 font-bold">
                      <td className="px-6 py-4 text-gray-900">Total</td>
                      <td className="px-6 py-4 text-right text-gray-900">
                        {formatRupee(totalSales)}
                      </td>
                      <td className="px-6 py-4 text-right text-emerald-700">
                        {formatRupee(totalCommission)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-900">
                        {formatRupee(totalSales - totalCommission)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
