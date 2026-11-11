"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SellerApplication = {
  id: string;
  business_name: string;
  business_type: string | null;
  business_address: string | null;
  gstin: string | null;
  status: string;
  created_at: string;
  auth_uid: string | null;
  owner_name: string | null;
  owner_email: string | null;
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AdminSellersApplicationsContent() {
  const [applications, setApplications] = useState<SellerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase
        .from("sellers")
        .select("id, business_name, business_type, business_address, gstin, status, created_at, auth_uid")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      // Get owner profiles
      const authUids = (data || [])
        .map((s) => s.auth_uid)
        .filter(Boolean) as string[];

      const profileMap: Record<string, { full_name: string | null; email: string | null }> = {};

      if (authUids.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("auth_uid, full_name, email")
          .in("auth_uid", authUids);

        (profiles || []).forEach((p) => {
          profileMap[p.auth_uid] = {
            full_name: p.full_name,
            email: p.email,
          };
        });
      }

      setApplications(
        (data || []).map((s) => {
          const profile = s.auth_uid ? profileMap[s.auth_uid] : null;
          return {
            ...s,
            owner_name: profile?.full_name || null,
            owner_email: profile?.email || null,
          };
        })
      );
    } catch {
      setErrorMessage("Failed to load applications.");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  const updateStatus = async (sellerId: string, status: "approved" | "rejected") => {
    setWorkingId(sellerId);
    setErrorMessage(null);

    const { error } = await supabase
      .from("sellers")
      .update({ status })
      .eq("id", sellerId);

    setWorkingId(null);

    if (error) {
      setErrorMessage(`Failed to ${status} application: ${error.message}`);
      return;
    }

    setApplications((prev) => prev.filter((a) => a.id !== sellerId));
    if (expandedId === sellerId) setExpandedId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Seller Applications
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Review and manage pending seller applications
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Stats */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900">
              {loading ? "--" : applications.length}
            </p>
            <p className="text-xs text-gray-500">Pending applications</p>
          </div>
        </div>
      </div>

      {/* Applications Table */}
      {loading ? (
        <div className="flex items-center justify-center p-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
        </div>
      ) : applications.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-600"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-gray-900">All caught up!</h3>
          <p className="text-xs text-gray-500 mt-1">
            No pending seller applications at this time.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Business Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Owner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    GSTIN
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Business Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Applied
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {applications.map((app) => (
                  <>
                    <tr
                      key={app.id}
                      className="hover:bg-gray-50/60 transition cursor-pointer"
                      onClick={() =>
                        setExpandedId(expandedId === app.id ? null : app.id)
                      }
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {app.business_name}
                          </p>
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase">
                            Pending
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-900">
                          {app.owner_name || "--"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {app.owner_email || "--"}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-mono text-xs">
                        {app.gstin || "--"}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {app.business_type || "Commercial Merchant"}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {new Date(app.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div
                          className="flex items-center justify-end gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            disabled={workingId === app.id}
                            onClick={() =>
                              void updateStatus(app.id, "approved")
                            }
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                          >
                            {workingId === app.id ? "..." : "Approve"}
                          </button>
                          <button
                            disabled={workingId === app.id}
                            onClick={() =>
                              void updateStatus(app.id, "rejected")
                            }
                            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded details */}
                    {expandedId === app.id && (
                      <tr key={`${app.id}-details`}>
                        <td
                          colSpan={6}
                          className="px-6 py-4 bg-gray-50/80"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            <div>
                              <p className="font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                Business Address
                              </p>
                              <p className="text-gray-900">
                                {app.business_address || "Not provided"}
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                GSTIN
                              </p>
                              <p className="text-gray-900 font-mono">
                                {app.gstin || "Not provided"}
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                Application ID
                              </p>
                              <p className="text-gray-900 font-mono">
                                {app.id.slice(0, 12)}...
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
