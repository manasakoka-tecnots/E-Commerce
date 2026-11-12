"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";
import Spinner from "@/src/components/Spinner";

type LocationType = "warehouse" | "store" | "fulfillment_center";

type Location = {
  id: string;
  seller_id: string;
  name: string;
  type: LocationType;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  is_default: boolean;
  fulfillment_priority: number;
  created_at: string;
  updated_at: string;
};

type LocationInventoryCount = {
  location_id: string;
  total_items: number;
  total_stock: number;
};

const TYPE_CONFIG: Record<LocationType, { label: string; description: string; icon: React.ReactNode; color: string; bg: string; border: string; selectedBg: string }> = {
  warehouse: {
    label: "Warehouse",
    description: "Store bulk inventory and fulfill online orders",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
      </svg>
    ),
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-500",
    selectedBg: "bg-blue-50",
  },
  store: {
    label: "Retail store",
    description: "Physical shop for walk-in customers and POS sales",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016A3.001 3.001 0 0021 9.349m-18 0a2.985 2.985 0 003.69-2.098L7.5 4.5h9l.81 2.751A2.985 2.985 0 0021 9.35" />
      </svg>
    ),
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-500",
    selectedBg: "bg-emerald-50",
  },
  fulfillment_center: {
    label: "Fulfillment center",
    description: "Third-party logistics (3PL) for outsourced shipping",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.29-.504 1.125-1.125V11.25c0-2.474-1.689-4.58-4.06-5.165l-2.34-.584A1.5 1.5 0 0012 6.75h-3a1.5 1.5 0 00-1.5 1.5v10.125c0 .621.504 1.125 1.125 1.125h2.625" />
      </svg>
    ),
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-500",
    selectedBg: "bg-purple-50",
  },
};

const emptyForm = {
  name: "",
  type: "warehouse" as LocationType,
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  phone: "",
  email: "",
  is_active: true,
  is_default: false,
  fulfillment_priority: 1,
};

export default function LocationsContent() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [inventoryCounts, setInventoryCounts] = useState<Record<string, LocationInventoryCount>>({});
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | LocationType>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [sellerId, setSellerId] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);

  const updateForm = (field: string, value: string | boolean | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

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

  const loadLocations = useCallback(async () => {
    setLoading(true);
    const sid = await getSellerId();
    if (!sid) {
      setError("Could not identify seller account.");
      setLoading(false);
      return;
    }
    setSellerId(sid);

    const { data, error: fetchErr } = await supabase
      .from("seller_locations")
      .select("*")
      .eq("seller_id", sid)
      .order("fulfillment_priority", { ascending: true });

    if (fetchErr) {
      setError(fetchErr.message);
    } else {
      setLocations(data ?? []);
    }

    // Fetch inventory counts per location
    const { data: invData } = await supabase
      .from("location_inventory")
      .select("location_id, available")
      .in(
        "location_id",
        (data ?? []).map((l: Location) => l.id)
      );

    if (invData) {
      const counts: Record<string, LocationInventoryCount> = {};
      for (const row of invData) {
        if (!counts[row.location_id]) {
          counts[row.location_id] = { location_id: row.location_id, total_items: 0, total_stock: 0 };
        }
        counts[row.location_id].total_items += 1;
        counts[row.location_id].total_stock += row.available || 0;
      }
      setInventoryCounts(counts);
    }

    setLoading(false);
  }, [getSellerId]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  // Auto-dismiss alerts
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowPanel(false);
  };

  const handleEdit = (loc: Location) => {
    setEditingId(loc.id);
    setForm({
      name: loc.name,
      type: loc.type,
      address_line1: loc.address_line1,
      address_line2: loc.address_line2 ?? "",
      city: loc.city,
      state: loc.state,
      pincode: loc.pincode,
      country: loc.country,
      phone: loc.phone ?? "",
      email: loc.email ?? "",
      is_active: loc.is_active,
      is_default: loc.is_default,
      fulfillment_priority: loc.fulfillment_priority,
    });
    setShowPanel(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    if (!sellerId) {
      setError("Could not identify seller account.");
      setSubmitting(false);
      return;
    }

    if (form.is_default) {
      await supabase
        .from("seller_locations")
        .update({ is_default: false })
        .eq("seller_id", sellerId);
    }

    const payload = {
      seller_id: sellerId,
      name: form.name,
      type: form.type,
      address_line1: form.address_line1,
      address_line2: form.address_line2 || null,
      city: form.city,
      state: form.state,
      pincode: form.pincode,
      country: form.country,
      phone: form.phone || null,
      email: form.email || null,
      is_active: form.is_active,
      is_default: form.is_default,
      fulfillment_priority: form.fulfillment_priority,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error: updErr } = await supabase
        .from("seller_locations")
        .update(payload)
        .eq("id", editingId);
      if (updErr) setError(updErr.message);
      else {
        setSuccess("Location updated successfully");
        resetForm();
        loadLocations();
      }
    } else {
      const { error: insertErr } = await supabase
        .from("seller_locations")
        .insert(payload);
      if (insertErr) setError(insertErr.message);
      else {
        setSuccess("Location added successfully");
        resetForm();
        loadLocations();
      }
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this location? Inventory data associated with it will also be removed. This cannot be undone.")) return;
    setDeleting(id);
    setError(null);

    const { error: delErr } = await supabase
      .from("seller_locations")
      .delete()
      .eq("id", id);

    if (delErr) setError(delErr.message);
    else {
      setLocations((prev) => prev.filter((l) => l.id !== id));
      setSuccess("Location deleted");
    }
    setDeleting(null);
  };

  const handleToggleActive = async (loc: Location) => {
    setError(null);
    const { error: togErr } = await supabase
      .from("seller_locations")
      .update({ is_active: !loc.is_active, updated_at: new Date().toISOString() })
      .eq("id", loc.id);

    if (togErr) setError(togErr.message);
    else {
      setLocations((prev) =>
        prev.map((l) => (l.id === loc.id ? { ...l, is_active: !l.is_active } : l))
      );
    }
  };

  const movePriority = async (loc: Location, direction: "up" | "down") => {
    const sorted = [...locations].sort((a, b) => a.fulfillment_priority - b.fulfillment_priority);
    const idx = sorted.findIndex((l) => l.id === loc.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const other = sorted[swapIdx];
    const thisPriority = loc.fulfillment_priority;
    const otherPriority = other.fulfillment_priority;

    await Promise.all([
      supabase.from("seller_locations").update({ fulfillment_priority: otherPriority }).eq("id", loc.id),
      supabase.from("seller_locations").update({ fulfillment_priority: thisPriority }).eq("id", other.id),
    ]);

    setLocations((prev) =>
      prev
        .map((l) => {
          if (l.id === loc.id) return { ...l, fulfillment_priority: otherPriority };
          if (l.id === other.id) return { ...l, fulfillment_priority: thisPriority };
          return l;
        })
        .sort((a, b) => a.fulfillment_priority - b.fulfillment_priority)
    );
  };

  // Filtered locations
  const filtered = locations.filter((loc) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !loc.name.toLowerCase().includes(q) &&
        !loc.city.toLowerCase().includes(q) &&
        !loc.state.toLowerCase().includes(q) &&
        !loc.address_line1.toLowerCase().includes(q)
      )
        return false;
    }
    if (filterType !== "all" && loc.type !== filterType) return false;
    if (filterStatus === "active" && !loc.is_active) return false;
    if (filterStatus === "inactive" && loc.is_active) return false;
    return true;
  });

  // Sort: default first, then by priority
  const sortedLocations = [...filtered].sort((a, b) => {
    if (a.is_default && !b.is_default) return -1;
    if (!a.is_default && b.is_default) return 1;
    return a.fulfillment_priority - b.fulfillment_priority;
  });

  const totalLocations = locations.length;
  const activeLocations = locations.filter((l) => l.is_active).length;
  const totalInventory = Object.values(inventoryCounts).reduce((sum, c) => sum + c.total_stock, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header — Shopify style */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Locations</h1>
              <p className="mt-0.5 text-sm text-gray-500">
                Manage the places you stock inventory, fulfill orders, and sell products.
              </p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setShowPanel(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add location
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.06l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            {success}
          </div>
        )}

        {/* Overview stats bar */}
        <div className="mb-5 flex items-center gap-6 rounded-xl border border-gray-200 bg-white px-5 py-3.5 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
              <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-sm font-semibold text-gray-900">{totalLocations}</p>
            </div>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
              <svg className="h-4 w-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.06l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Active</p>
              <p className="text-sm font-semibold text-emerald-600">{activeLocations}</p>
            </div>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
              <svg className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total inventory</p>
              <p className="text-sm font-semibold text-indigo-600">{totalInventory.toLocaleString("en-IN")} units</p>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search locations..."
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as "all" | LocationType)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
            >
              <option value="all">All types</option>
              <option value="warehouse">Warehouse</option>
              <option value="store">Store</option>
              <option value="fulfillment_center">Fulfillment center</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as "all" | "active" | "inactive")}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
            >
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Fulfillment priority info */}
        {locations.length > 1 && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
            <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
            </svg>
            <span>
              <strong>Fulfillment priority:</strong> Orders are fulfilled from the highest priority location first. Use the arrows to reorder.
            </span>
          </div>
        )}

        {/* Location cards */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner />
          </div>
        ) : sortedLocations.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            {search || filterType !== "all" || filterStatus !== "all" ? (
              <>
                <h3 className="text-sm font-medium text-gray-900">No locations match your filters</h3>
                <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filters.</p>
              </>
            ) : (
              <>
                <h3 className="text-sm font-medium text-gray-900">No locations yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Add your first location to start managing inventory across multiple places.
                </p>
                <button
                  onClick={() => {
                    resetForm();
                    setShowPanel(true);
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add location
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {sortedLocations.map((loc, idx) => {
              const config = TYPE_CONFIG[loc.type];
              const inv = inventoryCounts[loc.id];
              const isFirst = idx === 0;
              const isLast = idx === sortedLocations.length - 1;
              const sortedAll = [...locations].sort((a, b) => a.fulfillment_priority - b.fulfillment_priority);
              const globalIdx = sortedAll.findIndex((l) => l.id === loc.id);

              return (
                <div
                  key={loc.id}
                  className={`group relative flex items-start gap-4 px-5 py-4 transition-colors hover:bg-gray-50 ${
                    !isFirst ? "border-t border-gray-100" : ""
                  } ${!loc.is_active ? "opacity-60" : ""}`}
                >
                  {/* Priority arrows */}
                  <div className="flex flex-col items-center gap-0.5 pt-1">
                    <button
                      onClick={() => movePriority(loc, "up")}
                      disabled={globalIdx === 0}
                      className="rounded p-0.5 text-gray-300 hover:text-gray-600 disabled:invisible"
                      title="Move up"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                      </svg>
                    </button>
                    <span className="text-[10px] font-medium text-gray-400">{loc.fulfillment_priority}</span>
                    <button
                      onClick={() => movePriority(loc, "down")}
                      disabled={globalIdx === sortedAll.length - 1}
                      className="rounded p-0.5 text-gray-300 hover:text-gray-600 disabled:invisible"
                      title="Move down"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                  </div>

                  {/* Type icon */}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${config.bg} ${config.color}`}>
                    {config.icon}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">{loc.name}</h3>
                      {loc.is_default && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                          <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          Default
                        </span>
                      )}
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                      {loc.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                          Inactive
                        </span>
                      )}
                    </div>

                    <p className="mt-0.5 text-xs text-gray-500 truncate">
                      {loc.address_line1}
                      {loc.address_line2 ? `, ${loc.address_line2}` : ""}, {loc.city}, {loc.state} {loc.pincode}
                    </p>

                    {/* Meta row */}
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                      {inv ? (
                        <span className="flex items-center gap-1">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                          </svg>
                          {inv.total_items} products · {inv.total_stock.toLocaleString("en-IN")} units
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-300">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                          </svg>
                          No inventory
                        </span>
                      )}
                      {loc.phone && (
                        <span className="flex items-center gap-1">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                          </svg>
                          {loc.phone}
                        </span>
                      )}
                      {loc.email && (
                        <span className="flex items-center gap-1">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                          </svg>
                          {loc.email}
                        </span>
                      )}
                      <span className="text-gray-300">
                        Added {new Date(loc.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => handleToggleActive(loc)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        loc.is_active
                          ? "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                          : "text-emerald-600 hover:bg-emerald-50"
                      }`}
                      title={loc.is_active ? "Deactivate" : "Activate"}
                    >
                      {loc.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => handleEdit(loc)}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(loc.id)}
                      disabled={deleting === loc.id}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-50"
                    >
                      {deleting === loc.id ? "..." : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Results count */}
        {!loading && locations.length > 0 && (
          <p className="mt-3 text-xs text-gray-400">
            Showing {sortedLocations.length} of {totalLocations} location{totalLocations !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Slide-over panel */}
      {showPanel && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-black/30 transition-opacity" onClick={resetForm} />

          {/* Panel */}
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto bg-white shadow-2xl">
            {/* Panel header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">
                {editingId ? "Edit location" : "Add location"}
              </h2>
              <button
                onClick={resetForm}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Panel body */}
            <form onSubmit={handleSubmit} className="px-6 py-5">
              <div className="space-y-5">
                {/* Location name */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Location name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => updateForm("name", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
                    placeholder="e.g. Main Warehouse, Downtown Store"
                  />
                </div>

                {/* Location type */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Location type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["warehouse", "store", "fulfillment_center"] as LocationType[]).map((t) => {
                      const c = TYPE_CONFIG[t];
                      const isSelected = form.type === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => updateForm("type", t)}
                          className={`group relative flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-3 text-center transition-all ${
                            isSelected
                              ? `${c.border} ${c.selectedBg} shadow-sm`
                              : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          {isSelected && (
                            <span className={`absolute -right-1.5 -top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full ${c.color.replace("text-", "bg-")}`}>
                              <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            </span>
                          )}
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isSelected ? c.bg : "bg-gray-100 group-hover:bg-gray-200"} transition-colors`}>
                            <span className={`${isSelected ? c.color : "text-gray-400 group-hover:text-gray-500"} [&>svg]:h-4 [&>svg]:w-4`}>{c.icon}</span>
                          </div>
                          <p className={`text-xs font-medium leading-tight ${isSelected ? "text-gray-900" : "text-gray-600"}`}>{c.label}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Address & Contact */}
                <div className="space-y-2.5">
                  <input
                    type="text"
                    required
                    value={form.address_line1}
                    onChange={(e) => updateForm("address_line1", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
                    placeholder="Street address *"
                  />
                  <input
                    type="text"
                    value={form.address_line2}
                    onChange={(e) => updateForm("address_line2", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
                    placeholder="Apartment, suite, etc. (optional)"
                  />
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      required
                      value={form.city}
                      onChange={(e) => updateForm("city", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
                      placeholder="City *"
                    />
                    <input
                      type="text"
                      required
                      value={form.state}
                      onChange={(e) => updateForm("state", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
                      placeholder="State *"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      required
                      value={form.pincode}
                      onChange={(e) => updateForm("pincode", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
                      placeholder="PIN code *"
                    />
                    <input
                      type="text"
                      value={form.country}
                      onChange={(e) => updateForm("country", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
                      placeholder="Country"
                    />
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => updateForm("phone", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
                      placeholder="Phone"
                    />
                  </div>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateForm("email", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
                    placeholder="Email (optional)"
                  />
                </div>

                {/* Settings */}
                <div className="flex items-center gap-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => updateForm("is_active", e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-gray-900 peer-checked:after:translate-x-full relative"></div>
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_default}
                      onChange={(e) => updateForm("is_default", e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-gray-900 peer-checked:after:translate-x-full relative"></div>
                    <span className="text-sm text-gray-700">Default</span>
                  </label>
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-sm text-gray-500">Priority</span>
                    <input
                      type="number"
                      min={1}
                      value={form.fulfillment_priority}
                      onChange={(e) => updateForm("fulfillment_priority", parseInt(e.target.value) || 1)}
                      className="w-14 rounded-lg border border-gray-300 px-2 py-1.5 text-center text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
                    />
                  </div>
                </div>

                {/* Delete button (edit mode only) */}
                {editingId && (
                  <div className="rounded-lg border border-red-100 bg-red-50 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-red-700">Delete this location</p>
                        <p className="text-xs text-red-500">This will remove all inventory data for this location.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          handleDelete(editingId);
                          resetForm();
                        }}
                        className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Panel footer */}
              <div className="sticky bottom-0 -mx-6 mt-6 border-t border-gray-200 bg-white px-6 py-4">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? "Saving..." : editingId ? "Save changes" : "Add location"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
