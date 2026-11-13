"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";
import Pagination, { usePagination } from "@/src/components/Pagination";
import Link from "next/link";
import { useStaff } from "@/src/context/StaffContext";

/* ─── Types ─────────────────────────────────────────────────────────── */

type SellerLocation = {
  id: string;
  name: string;
};

type AdjustmentRow = {
  id: string;
  created_at: string;
  listing_id: string;
  location_id: string | null;
  adjustment_type: string | null;
  old_available: number;
  new_available: number;
  quantity_change: number;
  reason: string | null;
  created_by: string | null;
  product_name: string;
  variant_title: string | null;
  sku: string | null;
  location_name: string | null;
  adjusted_by_name: string | null;
};

/* ─── Constants ─────────────────────────────────────────────────────── */

const ITEMS_PER_PAGE = 15;

const ADJUSTMENT_TYPES = [
  { value: "all", label: "All Types" },
  { value: "set", label: "Set" },
  { value: "adjust", label: "Adjust" },
  { value: "transfer_out", label: "Transfer Out" },
  { value: "transfer_in", label: "Transfer In" },
  { value: "order_committed", label: "Order Committed" },
  { value: "order_fulfilled", label: "Order Fulfilled" },
  { value: "order_cancelled", label: "Order Cancelled" },
  { value: "correction", label: "Correction" },
];

const DATE_RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

/* ─── Helpers ───────────────────────────────────────────────────────── */

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }) +
    " " +
    d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
}

function typeBadge(type: string | null) {
  const t = type ?? "unknown";
  const map: Record<string, { bg: string; text: string; label: string }> = {
    set: { bg: "bg-blue-100", text: "text-blue-800", label: "Set" },
    adjust: { bg: "bg-indigo-100", text: "text-indigo-800", label: "Adjust" },
    transfer_out: { bg: "bg-orange-100", text: "text-orange-800", label: "Transfer Out" },
    transfer_in: { bg: "bg-teal-100", text: "text-teal-800", label: "Transfer In" },
    order_committed: { bg: "bg-purple-100", text: "text-purple-800", label: "Order Committed" },
    order_fulfilled: { bg: "bg-green-100", text: "text-green-800", label: "Order Fulfilled" },
    order_cancelled: { bg: "bg-red-100", text: "text-red-800", label: "Order Cancelled" },
    correction: { bg: "bg-amber-100", text: "text-amber-800", label: "Correction" },
  };
  const style = map[t] ?? { bg: "bg-gray-100", text: "text-gray-800", label: t };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

/* ─── Component ─────────────────────────────────────────────────────── */

export default function AdjustmentsContent() {
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);
  const [locations, setLocations] = useState<SellerLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const { sellerId: staffSellerId, isStaff, assignedLocationIds } = useStaff();

  const [selectedLocationId, setSelectedLocationId] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("30");

  /* ── Data loading ────────────────────────────────────────────────── */

  const loadData = useCallback(async () => {
    setLoading(true);

    // 1. Auth flow: user → profile → seller
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_uid", userData.user.id)
      .maybeSingle();
    if (!profile) {
      setLoading(false);
      return;
    }

    let resolvedSellerId = staffSellerId;
    if (!resolvedSellerId) {
      const { data: seller } = await supabase
        .from("sellers")
        .select("id")
        .eq("profile_id", profile.id)
        .maybeSingle();
      resolvedSellerId = seller?.id ?? null;
    }
    if (!resolvedSellerId) {
      setLoading(false);
      return;
    }

    // 2. Fetch seller locations
    const { data: locs } = await supabase
      .from("seller_locations")
      .select("id, name")
      .eq("seller_id", resolvedSellerId)
      .order("name");

    let sellerLocations: SellerLocation[] = (locs ?? []).map((l: any) => ({
      id: l.id,
      name: l.name,
    }));

    // Staff: filter to only assigned locations
    if (isStaff && assignedLocationIds.length > 0) {
      sellerLocations = sellerLocations.filter((l) => assignedLocationIds.includes(l.id));
    }
    setLocations(sellerLocations);

    const locationIds = sellerLocations.map((l) => l.id);

    // 3. Fetch seller listings (to scope adjustments to this seller)
    const { data: listings, error: listingsError } = await supabase
      .from("seller_listings")
      .select("id, product_id, products(name, sku)")
      .eq("seller_id", resolvedSellerId);

    if (listingsError) {
      console.error("Failed to load listings:", listingsError);
    }

    if (!listings || listings.length === 0) {
      setAdjustments([]);
      setLoading(false);
      return;
    }

    const listingIds = listings.map((l: any) => l.id);
    const listingProductMap: Record<string, { name: string; sku: string | null }> = {};
    for (const l of listings as any[]) {
      const prod = Array.isArray(l.products) ? l.products[0] : l.products;
      listingProductMap[l.id] = {
        name: prod?.name ?? "Untitled",
        sku: prod?.sku ?? null,
      };
    }

    const locationNameMap: Record<string, string> = {};
    for (const loc of sellerLocations) {
      locationNameMap[loc.id] = loc.name;
    }

    // 4. Build query for inventory_adjustments
    let query = supabase
      .from("inventory_adjustments")
      .select("id, created_at, listing_id, location_id, adjustment_type, quantity_change, old_available, new_available, reason, created_by, variant_title")
      .in("listing_id", listingIds)
      .order("created_at", { ascending: false });

    // Staff: only show adjustments for assigned locations
    if (isStaff && assignedLocationIds.length > 0) {
      query = query.in("location_id", assignedLocationIds);
    }

    // Date range filter
    if (dateRange !== "all") {
      const days = parseInt(dateRange, 10);
      const since = new Date();
      since.setDate(since.getDate() - days);
      query = query.gte("created_at", since.toISOString());
    }

    const { data: adjData, error: adjError } = await query;

    if (adjError) {
      console.error("Failed to load adjustments:", adjError);
    }

    if (!adjData) {
      setAdjustments([]);
      setLoading(false);
      return;
    }

    // 5. Fetch profile names for created_by
    const creatorIds = [
      ...new Set(
        (adjData as any[])
          .map((a) => a.created_by)
          .filter(Boolean)
      ),
    ];

    const profileNameMap: Record<string, string> = {};
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", creatorIds);

      if (profiles) {
        for (const p of profiles as any[]) {
          profileNameMap[p.id] = p.full_name ?? "Unknown";
        }
      }
    }

    // 6. Build rows
    const rows: AdjustmentRow[] = (adjData as any[]).map((a) => ({
      id: a.id,
      created_at: a.created_at,
      listing_id: a.listing_id,
      location_id: a.location_id,
      adjustment_type: a.adjustment_type ?? null,
      old_available: Number(a.old_available) || 0,
      new_available: Number(a.new_available) || 0,
      quantity_change: Number(a.quantity_change) || 0,
      reason: a.reason ?? null,
      created_by: a.created_by ?? null,
      product_name: listingProductMap[a.listing_id]?.name ?? "Unknown product",
      variant_title: a.variant_title ?? null,
      sku: listingProductMap[a.listing_id]?.sku ?? null,
      location_name: a.location_id ? (locationNameMap[a.location_id] ?? "Unknown") : null,
      adjusted_by_name: a.created_by ? (profileNameMap[a.created_by] ?? "Unknown") : null,
    }));

    setAdjustments(rows);
    setLoading(false);
  }, [dateRange, staffSellerId, isStaff, assignedLocationIds]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-select single location for staff with one assignment
  useEffect(() => {
    if (isStaff && locations.length === 1 && selectedLocationId === "all") {
      setSelectedLocationId(locations[0].id);
    }
  }, [isStaff, locations, selectedLocationId]);

  /* ── Filtered data ───────────────────────────────────────────────── */

  const filtered = useMemo(() => {
    return adjustments.filter((a) => {
      if (selectedLocationId !== "all" && a.location_id !== selectedLocationId) return false;
      if (selectedType !== "all" && a.adjustment_type !== selectedType) return false;
      return true;
    });
  }, [adjustments, selectedLocationId, selectedType]);

  const { currentPage, setCurrentPage, paginatedItems } = usePagination(filtered, ITEMS_PER_PAGE);

  /* ── Rendering ───────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/seller/products/inventory"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition mb-3"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Inventory
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Adjustment History</h1>
        <p className="mt-1 text-sm text-gray-500">
          Full audit trail of all inventory changes
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Location filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="adj-location" className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Location:
            </label>
            <select
              id="adj-location"
              value={selectedLocationId}
              onChange={(e) => {
                setSelectedLocationId(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-300/30 outline-none"
            >
              {(!isStaff || locations.length > 1) && (
                <option value="all">All locations</option>
              )}
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="adj-type" className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Type:
            </label>
            <select
              id="adj-type"
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-300/30 outline-none"
            >
              {ADJUSTMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date range filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="adj-date" className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Period:
            </label>
            <select
              id="adj-date"
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-300/30 outline-none"
            >
              {DATE_RANGES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Date/Time</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Change</th>
                <th className="py-3 px-4">Old &rarr; New</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Adjusted By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-sm text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <svg
                        className="h-10 w-10 text-gray-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <p>No adjustment records found.</p>
                      <p className="text-xs text-gray-300">
                        Try changing the filters or date range.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((row) => {
                  const delta = row.quantity_change;
                  const deltaStr = delta > 0 ? `+${delta}` : String(delta);
                  const deltaColor =
                    delta > 0
                      ? "text-green-600"
                      : delta < 0
                      ? "text-red-600"
                      : "text-gray-400";

                  return (
                    <tr key={row.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-3 px-4 whitespace-nowrap text-gray-700">
                        {formatDateTime(row.created_at)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-900">
                          {row.product_name}
                        </span>
                        {row.variant_title && (
                          <span className="block text-xs text-gray-500 mt-0.5">
                            {row.variant_title}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {row.sku ? (
                          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-mono font-medium text-gray-700">
                            {row.sku}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300 italic">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {row.location_name ?? (
                          <span className="text-gray-300">&mdash;</span>
                        )}
                      </td>
                      <td className="py-3 px-4">{typeBadge(row.adjustment_type)}</td>
                      <td className="py-3 px-4">
                        <span className={`font-semibold ${deltaColor}`}>
                          {deltaStr}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-700 whitespace-nowrap">
                        {row.old_available} &rarr; {row.new_available}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {row.reason ?? (
                          <span className="text-gray-300">&mdash;</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {row.adjusted_by_name ?? (
                          <span className="text-gray-300">System</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalItems={filtered.length}
        itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={setCurrentPage}
        itemLabel="adjustments"
      />
    </div>
  );
}
