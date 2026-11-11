"use client";

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/src/lib/supabase/client";
import Spinner from "@/src/components/Spinner";
import Pagination, { usePagination } from "@/src/components/Pagination";

type Discount = {
  id: string;
  seller_id: string;
  code: string;
  type: string;
  value: number;
  min_purchase: number | null;
  usage_limit: number | null;
  usage_count: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

const generateCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const discountStatus = (d: Discount): { label: string; cls: string } => {
  if (!d.is_active) return { label: "Inactive", cls: "bg-gray-100 text-gray-700" };
  if (d.usage_limit && d.usage_count >= d.usage_limit)
    return { label: "Used Up", cls: "bg-orange-100 text-orange-700" };
  if (d.end_date && new Date(d.end_date) < new Date())
    return { label: "Expired", cls: "bg-red-100 text-red-700" };
  return { label: "Active", cls: "bg-green-100 text-green-700" };
};

export default function DiscountsContent() {
  const ITEMS_PER_PAGE = 8;
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form
  const [code, setCode] = useState("");
  const [type, setType] = useState("percentage");
  const [value, setValue] = useState("");
  const [minPurchase, setMinPurchase] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(true);

  const getSellerId = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_uid", userData.user.id)
      .maybeSingle();
    if (!profile) return null;
    const { data: seller } = await supabase
      .from("sellers")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("status", "approved")
      .maybeSingle();
    return seller?.id ?? null;
  }, []);

  const loadDiscounts = useCallback(async () => {
    setLoading(true);
    const sellerId = await getSellerId();
    if (!sellerId) {
      setLoading(false);
      return;
    }

    const { data, error: fetchErr } = await supabase
      .from("discounts")
      .select("*")
      .eq("seller_id", sellerId)
      .order("created_at", { ascending: false });

    if (fetchErr) setError(fetchErr.message);
    else setDiscounts(data ?? []);
    setLoading(false);
  }, [getSellerId]);

  useEffect(() => {
    loadDiscounts();
  }, [loadDiscounts]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const sellerId = await getSellerId();
    if (!sellerId) {
      setError("Seller profile not found");
      setSubmitting(false);
      return;
    }

    const { error: insertErr } = await supabase.from("discounts").insert({
      seller_id: sellerId,
      code: code.toUpperCase(),
      type,
      value: parseFloat(value) || 0,
      min_purchase: minPurchase ? parseFloat(minPurchase) : null,
      usage_limit: usageLimit ? parseInt(usageLimit) : null,
      usage_count: 0,
      is_active: isActive,
      start_date: startDate || null,
      end_date: endDate || null,
    });

    if (insertErr) {
      setError(insertErr.message);
    } else {
      setSuccess("Discount created!");
      setCode("");
      setType("percentage");
      setValue("");
      setMinPurchase("");
      setUsageLimit("");
      setStartDate("");
      setEndDate("");
      setIsActive(true);
      setShowForm(false);
      loadDiscounts();
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this discount?")) return;
    const { error: delErr } = await supabase.from("discounts").delete().eq("id", id);
    if (delErr) setError(delErr.message);
    else loadDiscounts();
  };

  const { currentPage, setCurrentPage, paginatedItems: paginatedDiscounts } = usePagination(discounts, ITEMS_PER_PAGE);

  const handleToggle = async (d: Discount) => {
    const { error: updErr } = await supabase
      .from("discounts")
      .update({ is_active: !d.is_active })
      .eq("id", d.id);
    if (updErr) setError(updErr.message);
    else loadDiscounts();
  };

  return (
    
      <div className="min-h-screen bg-gray-50 p-6 md:p-10">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Discounts</h1>
              <p className="mt-1 text-sm text-gray-500">
                Create and manage discount codes for your customers.
              </p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600"
            >
              {showForm ? "Cancel" : "Create Discount"}
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {success}
            </div>
          )}

          {/* Create Form */}
          {showForm && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">New Discount</h2>
              <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Discount Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                      placeholder="SUMMER20"
                    />
                    <button
                      type="button"
                      onClick={() => setCode(generateCode())}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      Auto-generate
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                    <option value="free_shipping">Free Shipping</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Value {type === "percentage" ? "(%)" : type === "fixed" ? "(INR)" : ""}
                  </label>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    disabled={type === "free_shipping"}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:bg-gray-100"
                    placeholder={type === "percentage" ? "20" : "500"}
                    min="0"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Minimum Purchase (INR)
                  </label>
                  <input
                    type="number"
                    value={minPurchase}
                    onChange={(e) => setMinPurchase(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    placeholder="1000"
                    min="0"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Usage Limit
                  </label>
                  <input
                    type="number"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    placeholder="100 (leave empty for unlimited)"
                    min="1"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                </div>

                <div className="flex items-center gap-2 sm:col-span-2">
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="h-5 w-9 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-indigo-500 peer-checked:after:translate-x-full"></div>
                  </label>
                  <span className="text-sm text-gray-700">Active immediately</span>
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
                  >
                    {submitting ? "Creating..." : "Create Discount"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Discounts Table */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Spinner />
              </div>
            ) : discounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <svg
                  className="mb-4 h-12 w-12 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 14.25l3-3m0 0l3 3m-3-3v8.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="text-sm font-medium text-gray-900">No discounts yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Create discount codes to boost your sales.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 font-medium text-gray-700">Code</th>
                      <th className="px-4 py-3 font-medium text-gray-700">Type</th>
                      <th className="px-4 py-3 font-medium text-gray-700">Value</th>
                      <th className="px-4 py-3 font-medium text-gray-700">Min Purchase</th>
                      <th className="px-4 py-3 font-medium text-gray-700">Usage</th>
                      <th className="px-4 py-3 font-medium text-gray-700">Status</th>
                      <th className="px-4 py-3 font-medium text-gray-700">Dates</th>
                      <th className="px-4 py-3 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedDiscounts.map((d) => {
                      const status = discountStatus(d);
                      return (
                        <tr key={d.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono font-medium text-gray-900">
                            {d.code}
                          </td>
                          <td className="px-4 py-3 capitalize text-gray-600">
                            {d.type === "free_shipping" ? "Free Shipping" : d.type}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {d.type === "percentage"
                              ? `${d.value}%`
                              : d.type === "fixed"
                                ? `INR ${d.value}`
                                : "-"}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {d.min_purchase ? `INR ${d.min_purchase}` : "-"}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {d.usage_count}
                            {d.usage_limit ? ` / ${d.usage_limit}` : " / Unlimited"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${status.cls}`}
                            >
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {d.start_date
                              ? new Date(d.start_date).toLocaleDateString("en-IN")
                              : "-"}{" "}
                            -{" "}
                            {d.end_date
                              ? new Date(d.end_date).toLocaleDateString("en-IN")
                              : "No end"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleToggle(d)}
                                className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium hover:bg-gray-50"
                              >
                                {d.is_active ? "Deactivate" : "Activate"}
                              </button>
                              <button
                                onClick={() => handleDelete(d.id)}
                                className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination currentPage={currentPage} totalItems={discounts.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} itemLabel="discounts" />
          </div>
        </div>
      </div>
    
  );
}
