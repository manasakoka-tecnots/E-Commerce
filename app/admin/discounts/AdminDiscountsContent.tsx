"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Discount = {
  id: string;
  code: string;
  seller_id: string | null;
  discount_type: string;
  discount_value: number;
  is_active: boolean;
  usage_count: number;
  usage_limit: number | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  seller_name?: string;
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

export default function AdminDiscountsContent() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [newCode, setNewCode] = useState("");
  const [newType, setNewType] = useState<"percentage" | "fixed">("percentage");
  const [newValue, setNewValue] = useState("");
  const [newLimit, setNewLimit] = useState("");
  const [newStartsAt, setNewStartsAt] = useState("");
  const [newEndsAt, setNewEndsAt] = useState("");
  const [creating, setCreating] = useState(false);

  const loadDiscounts = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase
        .from("discounts")
        .select("id, code, seller_id, discount_type, discount_value, is_active, usage_count, usage_limit, starts_at, ends_at, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      // Get seller names
      const sellerIds = [
        ...new Set(
          (data || []).map((d) => d.seller_id).filter(Boolean) as string[]
        ),
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

      setDiscounts(
        (data || []).map((d) => ({
          ...d,
          seller_name: d.seller_id
            ? sellerMap[d.seller_id] || "Unknown"
            : "Platform-wide",
        }))
      );
    } catch {
      setErrorMessage("Failed to load discounts.");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDiscounts();
  }, [loadDiscounts]);

  const createDiscount = async () => {
    if (!newCode.trim() || !newValue) return;
    setCreating(true);
    setErrorMessage(null);

    const { error } = await supabase.from("discounts").insert({
      code: newCode.trim().toUpperCase(),
      discount_type: newType,
      discount_value: parseFloat(newValue),
      is_active: true,
      usage_count: 0,
      usage_limit: newLimit ? parseInt(newLimit, 10) : null,
      starts_at: newStartsAt || null,
      ends_at: newEndsAt || null,
      seller_id: null, // platform-wide
    });

    setCreating(false);

    if (error) {
      setErrorMessage(`Failed to create discount: ${error.message}`);
      return;
    }

    setNewCode("");
    setNewValue("");
    setNewLimit("");
    setNewStartsAt("");
    setNewEndsAt("");
    setShowCreate(false);
    void loadDiscounts();
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from("discounts")
      .update({ is_active: !currentActive })
      .eq("id", id);

    if (error) {
      setErrorMessage(`Failed to update discount: ${error.message}`);
      return;
    }

    setDiscounts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, is_active: !currentActive } : d))
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "--";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const inputClass =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-200";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Discounts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage platform and seller discount codes
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition"
        >
          {showCreate ? "Cancel" : "Create Platform Discount"}
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4">
            New Platform-wide Discount
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Code
              </label>
              <input
                type="text"
                className={inputClass}
                placeholder="e.g. SAVE20"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Type
              </label>
              <select
                className={inputClass}
                value={newType}
                onChange={(e) =>
                  setNewType(e.target.value as "percentage" | "fixed")
                }
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (INR)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Value
              </label>
              <input
                type="number"
                min={0}
                className={inputClass}
                placeholder={newType === "percentage" ? "e.g. 20" : "e.g. 100"}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Usage Limit (optional)
              </label>
              <input
                type="number"
                min={0}
                className={inputClass}
                placeholder="Leave empty for unlimited"
                value={newLimit}
                onChange={(e) => setNewLimit(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Starts At
              </label>
              <input
                type="date"
                className={inputClass}
                value={newStartsAt}
                onChange={(e) => setNewStartsAt(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Ends At
              </label>
              <input
                type="date"
                className={inputClass}
                value={newEndsAt}
                onChange={(e) => setNewEndsAt(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => void createDiscount()}
              disabled={creating || !newCode.trim() || !newValue}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {creating ? "Creating..." : "Create Discount"}
            </button>
          </div>
        </div>
      )}

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
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Seller
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Value
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Dates
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {discounts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-gray-900">
                          No discounts yet
                        </p>
                        <p className="text-xs text-gray-500">
                          Create a platform-wide discount to get started.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  discounts.map((d) => (
                    <tr
                      key={d.id}
                      className="hover:bg-gray-50/60 transition"
                    >
                      <td className="px-6 py-4">
                        <span className="inline-block rounded bg-gray-100 px-2 py-1 font-mono text-xs font-bold text-gray-800">
                          {d.code}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {d.seller_name}
                      </td>
                      <td className="px-6 py-4 text-gray-600 capitalize">
                        {d.discount_type}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">
                        {d.discount_type === "percentage"
                          ? `${d.discount_value}%`
                          : formatRupee(d.discount_value)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                            d.is_active
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {d.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        {d.usage_count}
                        {d.usage_limit ? ` / ${d.usage_limit}` : ""}
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-xs">
                        {formatDate(d.starts_at)} - {formatDate(d.ends_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => void toggleActive(d.id, d.is_active)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                            d.is_active
                              ? "border border-gray-300 text-gray-600 hover:bg-gray-100"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          }`}
                        >
                          {d.is_active ? "Deactivate" : "Activate"}
                        </button>
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
