"use client";

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/src/lib/supabase/client";
import { useStaff } from "@/src/context/StaffContext";
import Spinner from "@/src/components/Spinner";

type Campaign = {
  id: string;
  seller_id: string;
  name: string;
  type: string;
  channel: string;
  status: string;
  budget: number;
  spent: number;
  reach: number;
  start_date: string;
  end_date: string | null;
  created_at: string;
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    active: "bg-green-100 text-green-700",
    paused: "bg-yellow-100 text-yellow-700",
    completed: "bg-blue-100 text-blue-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
};

const formatRupee = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);

export default function MarketingContent() {
  const { sellerId: staffSellerId } = useStaff();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [type, setType] = useState("manual");
  const [channel, setChannel] = useState("email");
  const [budget, setBudget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    let resolvedSellerId = staffSellerId;
    if (!resolvedSellerId) {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_uid", userData.user.id)
        .maybeSingle();
      if (!profile) {
        setLoading(false);
        return;
      }
      const { data: seller } = await supabase
        .from("sellers")
        .select("id")
        .eq("profile_id", profile.id)
        .eq("status", "approved")
        .maybeSingle();
      resolvedSellerId = seller?.id ?? null;
    }
    if (!resolvedSellerId) {
      setLoading(false);
      return;
    }

    const { data, error: fetchErr } = await supabase
      .from("marketing_campaigns")
      .select("*")
      .eq("seller_id", resolvedSellerId)
      .order("created_at", { ascending: false });

    if (fetchErr) setError(fetchErr.message);
    else setCampaigns(data ?? []);
    setLoading(false);
  }, [staffSellerId]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    let resolvedSellerId = staffSellerId;
    if (!resolvedSellerId) {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setError("Not authenticated");
        setSubmitting(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_uid", userData.user.id)
        .maybeSingle();
      if (!profile) {
        setError("Profile not found");
        setSubmitting(false);
        return;
      }
      const { data: seller } = await supabase
        .from("sellers")
        .select("id")
        .eq("profile_id", profile.id)
        .eq("status", "approved")
        .maybeSingle();
      resolvedSellerId = seller?.id ?? null;
    }
    if (!resolvedSellerId) {
      setError("Seller profile not found");
      setSubmitting(false);
      return;
    }

    const { error: insertErr } = await supabase
      .from("marketing_campaigns")
      .insert({
        seller_id: resolvedSellerId,
        name,
        type,
        channel,
        budget: parseFloat(budget) || 0,
        spent: 0,
        reach: 0,
        status: "draft",
        start_date: startDate || null,
        end_date: endDate || null,
      });

    if (insertErr) {
      setError(insertErr.message);
    } else {
      setSuccess("Campaign created!");
      setName("");
      setType("manual");
      setChannel("email");
      setBudget("");
      setStartDate("");
      setEndDate("");
      setShowForm(false);
      loadCampaigns();
    }
    setSubmitting(false);
  };

  return (
    
      <div className="min-h-screen bg-gray-50 p-6 md:p-10">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Marketing Campaigns</h1>
              <p className="mt-1 text-sm text-gray-500">
                Create and manage marketing campaigns for your store.
              </p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600"
            >
              {showForm ? "Cancel" : "Create Campaign"}
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

          {/* Create Campaign Form */}
          {showForm && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">New Campaign</h2>
              <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    placeholder="Summer Sale Blast"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  >
                    <option value="manual">Manual</option>
                    <option value="automated">Automated</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Channel</label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  >
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="social">Social Media</option>
                    <option value="push">Push Notification</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Budget</label>
                  <input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    placeholder="5000"
                    min="0"
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

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
                  >
                    {submitting ? "Creating..." : "Create Campaign"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Campaigns Table */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Spinner />
              </div>
            ) : campaigns.length === 0 ? (
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
                    d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
                  />
                </svg>
                <h3 className="text-sm font-medium text-gray-900">No campaigns yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Create your first marketing campaign to reach more customers.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 font-medium text-gray-700">Campaign Name</th>
                      <th className="px-4 py-3 font-medium text-gray-700">Type</th>
                      <th className="px-4 py-3 font-medium text-gray-700">Channel</th>
                      <th className="px-4 py-3 font-medium text-gray-700">Status</th>
                      <th className="px-4 py-3 font-medium text-gray-700">Budget</th>
                      <th className="px-4 py-3 font-medium text-gray-700">Spent</th>
                      <th className="px-4 py-3 font-medium text-gray-700">Reach</th>
                      <th className="px-4 py-3 font-medium text-gray-700">Start Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {campaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                        <td className="px-4 py-3 capitalize text-gray-600">{c.type}</td>
                        <td className="px-4 py-3 capitalize text-gray-600">{c.channel}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadge(c.status)}`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{formatRupee(c.budget)}</td>
                        <td className="px-4 py-3 text-gray-600">{formatRupee(c.spent)}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {c.reach.toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {c.start_date
                            ? new Date(c.start_date).toLocaleDateString("en-IN")
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    
  );
}
