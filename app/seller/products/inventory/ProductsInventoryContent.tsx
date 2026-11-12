"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";
import Pagination, { usePagination } from "@/src/components/Pagination";
import Link from "next/link";

/* ─── Types ─────────────────────────────────────────────────────────── */

type SellerLocation = {
  id: string;
  name: string;
  is_default: boolean;
};

type LocationStock = {
  location_id: string;
  location_name: string;
  available: number;
  committed: number;
  incoming: number;
};

type ProductVariant = {
  id: string;
  title: string;
  sku: string | null;
  stock: number;
  price: number | null;
  is_available: boolean;
  location_stock: LocationStock[];
};

type InventoryItem = {
  listing_id: string;
  product_id: string;
  product_name: string;
  sku: string | null;
  legacy_stock: number;
  status: string;
  location_stock: LocationStock[];
  variants: ProductVariant[];
};

/** A flattened row — either a standalone product or one variant of a product */
type InventoryRow = {
  /** Unique key for this row */
  rowId: string;
  listing_id: string;
  product_id: string;
  product_name: string;
  /** Variant title (e.g. "Red / 128GB") — null if standalone product */
  variant_title: string | null;
  variant_id: string | null;
  sku: string | null;
  /** Whether this is the first row in a product group (shows product name) */
  isFirstInGroup: boolean;
  /** How many rows this product group has (for rowspan) */
  groupSize: number;
  /** Stock fields */
  legacy_stock: number;
  location_stock: LocationStock[];
  /** The original item for adjustment modal */
  _item: InventoryItem;
  /** Variant stock (used when variant exists) */
  variant_stock: number | null;
  is_available: boolean;
};

type AdjustmentMode = "set" | "add" | "remove" | "damaged" | "missing";

type AdjustmentReason =
  | "restock"
  | "correction"
  | "damaged"
  | "returned"
  | "count_adjustment"
  | "missing"
  | "other";

const REASON_OPTIONS: { value: AdjustmentReason; label: string }[] = [
  { value: "restock", label: "Restock" },
  { value: "correction", label: "Correction" },
  { value: "damaged", label: "Damaged" },
  { value: "returned", label: "Returned" },
  { value: "missing", label: "Missing" },
  { value: "count_adjustment", label: "Count adjustment" },
  { value: "other", label: "Other" },
];

const ADJUST_MODES: { value: AdjustmentMode; label: string; icon: string; desc: string; defaultReason: AdjustmentReason }[] = [
  { value: "set", label: "Set", icon: "=", desc: "Set exact quantity", defaultReason: "correction" },
  { value: "add", label: "Add", icon: "+", desc: "Increase stock", defaultReason: "restock" },
  { value: "remove", label: "Remove", icon: "−", desc: "Decrease stock", defaultReason: "correction" },
  { value: "damaged", label: "Damaged", icon: "!", desc: "Mark as damaged", defaultReason: "damaged" },
  { value: "missing", label: "Missing", icon: "?", desc: "Mark as missing", defaultReason: "missing" },
];

type LocationAdjustment = {
  location_id: string;
  location_name: string;
  current_available: number;
  value: string;
  reason: AdjustmentReason;
  notes: string;
};

/* ─── Helpers ───────────────────────────────────────────────────────── */

function getAggregated(item: InventoryItem) {
  const available = item.location_stock.reduce((s, l) => s + l.available, 0);
  const committed = item.location_stock.reduce((s, l) => s + l.committed, 0);
  const incoming = item.location_stock.reduce((s, l) => s + l.incoming, 0);
  return { available, committed, incoming, onHand: available + committed + incoming };
}

function getLocationStock(item: InventoryItem, locationId: string) {
  const ls = item.location_stock.find((l) => l.location_id === locationId);
  const available = ls?.available ?? 0;
  const committed = ls?.committed ?? 0;
  const incoming = ls?.incoming ?? 0;
  return { available, committed, incoming, onHand: available + committed + incoming };
}

function stockStatus(available: number): "in_stock" | "low" | "out" {
  if (available === 0) return "out";
  if (available <= 5) return "low";
  return "in_stock";
}

/* ─── Component ─────────────────────────────────────────────────────── */

export default function ProductsInventoryContent() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<SellerLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellerId, setSellerId] = useState<string | null>(null);

  const [selectedLocationId, setSelectedLocationId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkQty, setBulkQty] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  // Adjustment modal
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustVariantId, setAdjustVariantId] = useState<string | null>(null);
  const [adjustMode, setAdjustMode] = useState<AdjustmentMode>("set");
  const [adjustEntries, setAdjustEntries] = useState<LocationAdjustment[]>([]);
  const [adjustSaving, setAdjustSaving] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const hasLocations = locations.length > 0;

  /* ── Data loading ────────────────────────────────────────────────── */

  const loadData = useCallback(async (sid: string) => {
    const { data: locs } = await supabase
      .from("seller_locations")
      .select("id, name, is_default")
      .eq("seller_id", sid)
      .order("is_default", { ascending: false })
      .order("name");

    const sellerLocations: SellerLocation[] = (locs ?? []).map((l: any) => ({
      id: l.id,
      name: l.name,
      is_default: !!l.is_default,
    }));
    setLocations(sellerLocations);

    const { data: listingsData, error: listingsErr } = await supabase
      .from("seller_listings")
      .select("id, product_id, stock, status")
      .eq("seller_id", sid)
      .order("created_at", { ascending: false });

    if (listingsErr) {
      console.error("Inventory fetch error:", JSON.stringify(listingsErr));
      setItems([]);
      return;
    }
    const listings = listingsData;

    if (!listings || listings.length === 0) {
      setItems([]);
      return;
    }

    const productIds = [...new Set(listings.map((l: any) => l.product_id).filter(Boolean))];
    const prodMap: Record<string, { name: string; sku: string | null }> = {};
    if (productIds.length > 0) {
      const { data: prodData } = await supabase
        .from("products")
        .select("id, name, sku")
        .in("id", productIds);
      for (const p of (prodData ?? [])) {
        prodMap[p.id] = { name: p.name, sku: p.sku };
      }
    }

    const listingIds = listings.map((l: any) => l.id);
    const { data: locInvData } = await supabase
      .from("location_inventory")
      .select("listing_id, location_id, variant_id, available, committed, incoming")
      .in("listing_id", listingIds);

    // Key: "listing_id|variant_id" (variant_id can be null for non-variant products)
    const locInvMap: Record<string, any[]> = {};
    for (const row of (locInvData ?? [])) {
      const key = `${row.listing_id}|${row.variant_id ?? ""}`;
      if (!locInvMap[key]) locInvMap[key] = [];
      locInvMap[key].push(row);
    }

    const variantsMap: Record<string, ProductVariant[]> = {};
    if (productIds.length > 0) {
      const { data: varData } = await supabase
        .from("product_variants")
        .select("id, product_id, title, sku, stock, price, is_available")
        .in("product_id", productIds);
      for (const v of (varData ?? [])) {
        if (!variantsMap[v.product_id]) variantsMap[v.product_id] = [];
        variantsMap[v.product_id].push({
          id: v.id,
          title: v.title,
          sku: v.sku ?? null,
          stock: Number(v.stock) || 0,
          price: v.price !== null ? Number(v.price) : null,
          is_available: v.is_available,
          location_stock: [], // will be populated below
        });
      }
    }

    const locNameMap: Record<string, string> = {};
    for (const loc of sellerLocations) {
      locNameMap[loc.id] = loc.name;
    }

    // Helper to build LocationStock[] from raw location_inventory rows
    const buildLocationStock = (rows: any[]): LocationStock[] =>
      rows
        .filter((r: any) => r && r.location_id)
        .map((r: any) => ({
          location_id: r.location_id,
          location_name: locNameMap[r.location_id] ?? "Unknown",
          available: Number(r.available) || 0,
          committed: Number(r.committed) || 0,
          incoming: Number(r.incoming) || 0,
        }));

    const mapped: InventoryItem[] = listings.map((l: any) => {
      const prod = prodMap[l.product_id];
      // For the listing-level stock (non-variant), use key with empty variant_id
      const rawLocInv: any[] = locInvMap[`${l.id}|`] ?? [];
      const locationStock = buildLocationStock(rawLocInv);

      // Build variants with per-variant location stock
      const variants: ProductVariant[] = (variantsMap[l.product_id] ?? []).map((v) => {
        const variantLocInv: any[] = locInvMap[`${l.id}|${v.id}`] ?? [];
        return {
          ...v,
          location_stock: buildLocationStock(variantLocInv),
        };
      });

      return {
        listing_id: l.id,
        product_id: l.product_id,
        product_name: prod?.name ?? "Untitled",
        sku: prod?.sku ?? null,
        legacy_stock: Number(l.stock) || 0,
        status: l.status,
        location_stock: locationStock,
        variants,
      };
    });

    setItems(mapped);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_uid", userData.user.id)
        .maybeSingle();
      if (!profile) { setLoading(false); return; }

      const { data: seller } = await supabase
        .from("sellers")
        .select("id")
        .eq("profile_id", profile.id)
        .maybeSingle();
      if (!seller) { setLoading(false); return; }

      setSellerId(seller.id);
      await loadData(seller.id);
      setLoading(false);
    })();
  }, [loadData]);

  /* ── Flatten items into rows (Shopify-style) ──────────────────── */

  const flatRows: InventoryRow[] = useMemo(() => {
    const rows: InventoryRow[] = [];
    for (const item of items) {
      if (item.variants.length === 0) {
        // No variants — single row for the product
        rows.push({
          rowId: item.listing_id,
          listing_id: item.listing_id,
          product_id: item.product_id,
          product_name: item.product_name,
          variant_title: null,
          variant_id: null,
          sku: item.sku,
          isFirstInGroup: true,
          groupSize: 1,
          legacy_stock: item.legacy_stock,
          location_stock: item.location_stock,
          _item: item,
          variant_stock: null,
          is_available: true,
        });
      } else {
        // Has variants — one row per variant
        const groupSize = item.variants.length;
        item.variants.forEach((v, idx) => {
          rows.push({
            rowId: `${item.listing_id}-${v.id}`,
            listing_id: item.listing_id,
            product_id: item.product_id,
            product_name: item.product_name,
            variant_title: v.title,
            variant_id: v.id,
            sku: v.sku ?? item.sku,
            isFirstInGroup: idx === 0,
            groupSize,
            legacy_stock: item.legacy_stock,
            location_stock: v.location_stock, // per-variant location stock
            _item: item,
            variant_stock: v.stock,
            is_available: v.is_available,
          });
        });
      }
    }
    return rows;
  }, [items]);

  /* ── Computed data ───────────────────────────────────────────────── */

  function getRowAvailable(row: InventoryRow): number {
    if (!hasLocations) {
      return row.variant_stock !== null ? row.variant_stock : row.legacy_stock;
    }
    if (selectedLocationId === "all") {
      // "All locations": sum across all location_inventory records only
      return row.location_stock.reduce((s, l) => s + l.available, 0);
    }
    // Specific location: only show stock from location_inventory for this location
    const ls = row.location_stock.find((l) => l.location_id === selectedLocationId);
    return ls?.available ?? 0;
  }

  /** Check if a row is out-of-stock at any location (for "All locations" alerts) */
  function isOutAtAnyLocation(row: InventoryRow): boolean {
    if (!hasLocations || row.location_stock.length === 0) return getRowAvailable(row) === 0;
    // Check each location the seller has — if stock is 0 at any, flag it
    for (const loc of locations) {
      const ls = row.location_stock.find((l) => l.location_id === loc.id);
      if (!ls || ls.available === 0) return true;
    }
    return false;
  }

  /** Check if a row is low-stock (1-5) at any location (for "All locations" alerts) */
  function isLowAtAnyLocation(row: InventoryRow): boolean {
    if (!hasLocations || row.location_stock.length === 0) {
      const a = getRowAvailable(row);
      return a > 0 && a <= 5;
    }
    for (const loc of locations) {
      const ls = row.location_stock.find((l) => l.location_id === loc.id);
      const avail = ls?.available ?? 0;
      if (avail > 0 && avail <= 5) return true;
    }
    return false;
  }

  /** Get the minimum stock across all locations for a row (used for sorting alerts) */
  function getMinLocationStock(row: InventoryRow): number {
    if (!hasLocations || row.location_stock.length === 0) return getRowAvailable(row);
    let min = Infinity;
    for (const loc of locations) {
      const ls = row.location_stock.find((l) => l.location_id === loc.id);
      const avail = ls?.available ?? 0;
      if (avail < min) min = avail;
    }
    return min === Infinity ? 0 : min;
  }

  function getRowStockDetails(row: InventoryRow) {
    if (!hasLocations) {
      const avail = row.variant_stock !== null ? row.variant_stock : row.legacy_stock;
      return { available: avail, committed: 0, incoming: 0, onHand: avail };
    }
    if (selectedLocationId === "all") {
      const available = row.location_stock.reduce((s, l) => s + l.available, 0);
      const committed = row.location_stock.reduce((s, l) => s + l.committed, 0);
      const incoming = row.location_stock.reduce((s, l) => s + l.incoming, 0);
      return { available, committed, incoming, onHand: available + committed + incoming };
    }
    // Specific location: only show what's in location_inventory
    const ls = row.location_stock.find((l) => l.location_id === selectedLocationId);
    const available = ls?.available ?? 0;
    const committed = ls?.committed ?? 0;
    const incoming = ls?.incoming ?? 0;
    return { available, committed, incoming, onHand: available + committed + incoming };
  }

  const filtered = useMemo(() => {
    return flatRows.filter((r) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        r.product_name.toLowerCase().includes(q) ||
        (r.variant_title && r.variant_title.toLowerCase().includes(q)) ||
        (r.sku && r.sku.toLowerCase().includes(q));
      let matchFilter = true;
      if (filter === "low") {
        if (selectedLocationId === "all" && hasLocations) {
          matchFilter = !isOutAtAnyLocation(r) && isLowAtAnyLocation(r);
        } else {
          const avail = getRowAvailable(r);
          matchFilter = avail > 0 && avail <= 5;
        }
      } else if (filter === "out") {
        if (selectedLocationId === "all" && hasLocations) {
          matchFilter = isOutAtAnyLocation(r);
        } else {
          matchFilter = getRowAvailable(r) === 0;
        }
      }
      return matchSearch && matchFilter;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatRows, search, filter, selectedLocationId, hasLocations]);

  const ITEMS_PER_PAGE = 20;
  const { currentPage, setCurrentPage, paginatedItems } = usePagination(filtered, ITEMS_PER_PAGE);

  const totalStock = useMemo(() => {
    return flatRows.reduce((sum, r) => sum + getRowAvailable(r), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatRows, selectedLocationId, hasLocations]);

  const lowStockCount = useMemo(() => {
    if (selectedLocationId === "all" && hasLocations) {
      // "All locations": count items that are low stock at ANY location
      return flatRows.filter((r) => !isOutAtAnyLocation(r) && isLowAtAnyLocation(r)).length;
    }
    return flatRows.filter((r) => {
      const a = getRowAvailable(r);
      return a > 0 && a <= 5;
    }).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatRows, selectedLocationId, hasLocations, locations]);

  const outOfStockCount = useMemo(() => {
    if (selectedLocationId === "all" && hasLocations) {
      // "All locations": count items that are out of stock at ANY location
      return flatRows.filter((r) => isOutAtAnyLocation(r)).length;
    }
    return flatRows.filter((r) => getRowAvailable(r) === 0).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatRows, selectedLocationId, hasLocations, locations]);

  /* ── Selection ───────────────────────────────────────────────────── */

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r) => r.rowId)));
    }
  };

  /* ── Bulk update ─────────────────────────────────────────────────── */

  const handleBulkUpdate = async () => {
    if (!bulkQty || selectedIds.size === 0 || !sellerId) return;
    const qty = parseInt(bulkQty, 10);
    if (isNaN(qty) || qty < 0) return;

    setBulkSaving(true);
    try {
      // Get unique listing IDs from selected rows
      const listingIds = new Set<string>();
      for (const row of flatRows) {
        if (selectedIds.has(row.rowId)) listingIds.add(row.listing_id);
      }

      if (hasLocations && selectedLocationId !== "all") {
        // Use RPC for atomic inventory update (handles upsert + stock sync)
        for (const rowId of selectedIds) {
          const row = flatRows.find((r) => r.rowId === rowId);
          if (!row) continue;
          const { error: rpcErr } = await supabase.rpc("adjust_location_inventory", {
            p_location_id: selectedLocationId,
            p_listing_id: row.listing_id,
            p_adjustment_type: "set",
            p_quantity_change: qty,
            p_reason: "Bulk inventory update",
            p_variant_id: row.variant_id || null,
          });
          if (rpcErr) {
            console.error("Bulk adjust_location_inventory error:", rpcErr);
          }
        }
      } else {
        for (const id of listingIds) {
          await supabase
            .from("seller_listings")
            .update({ stock: qty })
            .eq("id", id);
        }
      }

      await loadData(sellerId);
      setSelectedIds(new Set());
      setBulkQty("");
      showToast("Bulk update saved successfully!", "success");
    } catch (err: any) {
      alert("Bulk update failed: " + (err?.message ?? "Unknown error"));
      showToast("Bulk update failed: " + (err?.message ?? "Unknown error"), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  /* ── Adjustment modal ────────────────────────────────────────────── */

  const openAdjustModal = (item: InventoryItem, variantId?: string | null) => {
    setAdjustItem(item);
    setAdjustVariantId(variantId ?? null);
    setAdjustMode("set" as AdjustmentMode);

    // Determine which location_stock to use — variant-specific or item-level
    const relevantStock = variantId
      ? (item.variants.find((v) => v.id === variantId)?.location_stock ?? [])
      : item.location_stock;
    const fallbackStock = variantId
      ? (item.variants.find((v) => v.id === variantId)?.stock ?? 0)
      : item.legacy_stock;

    if (!hasLocations) {
      setAdjustEntries([
        {
          location_id: "__legacy__",
          location_name: "Default",
          current_available: fallbackStock,
          value: String(fallbackStock),
          reason: "correction",
          notes: "",
        },
      ]);
    } else if (selectedLocationId !== "all") {
      const ls = relevantStock.find((l) => l.location_id === selectedLocationId);
      const locName = locations.find((l) => l.id === selectedLocationId)?.name ?? "Unknown";
      setAdjustEntries([
        {
          location_id: selectedLocationId,
          location_name: locName,
          current_available: ls?.available ?? 0,
          value: String(ls?.available ?? 0),
          reason: "correction",
          notes: "",
        },
      ]);
    } else {
      setAdjustEntries(
        locations.map((loc) => {
          const ls = relevantStock.find((l) => l.location_id === loc.id);
          return {
            location_id: loc.id,
            location_name: loc.name,
            current_available: ls?.available ?? 0,
            value: "0",
            reason: "correction" as AdjustmentReason,
            notes: "",
          };
        })
      );
    }
  };

  const closeAdjustModal = () => {
    setAdjustItem(null);
    setAdjustVariantId(null);
    setAdjustEntries([]);
  };

  const updateAdjustEntry = (index: number, patch: Partial<LocationAdjustment>) => {
    setAdjustEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, ...patch } : e))
    );
  };

  const getPreview = (entry: LocationAdjustment): { newValue: number; delta: number } => {
    const parsed = parseInt(entry.value, 10);
    const val = isNaN(parsed) ? 0 : Math.abs(parsed);
    if (adjustMode === "set") {
      const newValue = Math.max(0, val);
      return { newValue, delta: newValue - entry.current_available };
    } else if (adjustMode === "add") {
      const newValue = entry.current_available + val;
      return { newValue, delta: val };
    } else {
      // "remove", "damaged", "missing" — all subtract
      const newValue = Math.max(0, entry.current_available - val);
      return { newValue, delta: newValue - entry.current_available };
    }
  };

  const handleSaveAdjustment = async () => {
    if (!adjustItem || !sellerId) return;
    setAdjustSaving(true);

    try {
      for (const entry of adjustEntries) {
        const { newValue } = getPreview(entry);

        if (entry.location_id === "__legacy__") {
          // No locations — update seller_listings.stock directly
          await supabase
            .from("seller_listings")
            .update({ stock: newValue })
            .eq("id", adjustItem.listing_id);

          // Also update variant stock if applicable
          if (adjustVariantId) {
            await supabase
              .from("product_variants")
              .update({ stock: newValue })
              .eq("id", adjustVariantId);
          }
        } else {
          // Map frontend mode to RPC params
          let rpcType: string;
          let rpcQty: number;
          if (adjustMode === "set") {
            rpcType = "set";
            rpcQty = newValue;
          } else if (adjustMode === "add") {
            rpcType = "adjust";
            rpcQty = Math.abs(parseInt(entry.value, 10) || 0);
          } else {
            // "remove", "damaged", "missing" — subtract
            rpcType = "adjust";
            rpcQty = -Math.abs(parseInt(entry.value, 10) || 0);
          }
          const reasonText = [entry.reason, entry.notes].filter(Boolean).join(": ");
          const { error: rpcError } = await supabase.rpc("adjust_location_inventory", {
            p_location_id: entry.location_id,
            p_listing_id: adjustItem.listing_id,
            p_adjustment_type: rpcType,
            p_quantity_change: rpcQty,
            p_reason: reasonText || null,
            p_variant_id: adjustVariantId || null,
          });

          if (rpcError) {
            console.error("RPC error:", rpcError);
            alert("Failed to save: " + rpcError.message);
            showToast("Failed to save: " + rpcError.message, "error");
          }
        }
      }

      await loadData(sellerId);
      closeAdjustModal();
      showToast("Adjustment saved successfully!", "success");
    } catch (err: any) {
      alert("Adjustment failed: " + (err?.message ?? "Unknown error"));
      showToast("Adjustment failed: " + (err?.message ?? "Unknown error"), "error");
    } finally {
      setAdjustSaving(false);
    }
  };

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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage stock levels across all your locations
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Location selector — Shopify style, top-right */}
          {hasLocations && (
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <select
                value={selectedLocationId}
                onChange={(e) => {
                  setSelectedLocationId(e.target.value);
                  setSelectedIds(new Set());
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-300/30 outline-none"
              >
                <option value="all">All locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}{loc.is_default ? " (Default)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Link
            href="/seller/locations"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Manage Locations
          </Link>
        </div>
      </div>

      {/* No locations banner */}
      {!hasLocations && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800">
                You haven&apos;t set up any locations yet
              </p>
              <p className="mt-1 text-sm text-amber-700">
                Add a location to track per-location inventory, including committed and incoming stock.
              </p>
              <Link
                href="/seller/locations"
                className="mt-2 inline-flex items-center text-sm font-medium text-amber-800 underline decoration-amber-300 hover:decoration-amber-500"
              >
                Add your first location
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm text-gray-500">Total Products</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{items.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm text-gray-500">Total Stock</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {totalStock.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm text-amber-600 font-medium">Low Stock</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{lowStockCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm text-red-600 font-medium">Out of Stock</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{outOfStockCount}</p>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {(lowStockCount > 0 || outOfStockCount > 0) && hasLocations && (
        <details className="rounded-xl border border-red-200 bg-red-50/50 shadow-sm overflow-hidden" open={outOfStockCount > 0}>
          <summary className="px-5 py-3 cursor-pointer flex items-center gap-3 hover:bg-red-50 transition">
            <svg className="h-5 w-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-sm font-bold text-red-800">
              Stock Alerts — {outOfStockCount > 0 ? `${outOfStockCount} out of stock` : ""}{outOfStockCount > 0 && lowStockCount > 0 ? ", " : ""}{lowStockCount > 0 ? `${lowStockCount} low stock` : ""}
            </span>
            <svg className="h-4 w-4 text-red-400 ml-auto transition-transform [details[open]>&]:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="border-t border-red-200 divide-y divide-red-100">
            {flatRows
              .filter((r) => {
                if (selectedLocationId === "all" && hasLocations) {
                  return isOutAtAnyLocation(r) || isLowAtAnyLocation(r);
                }
                return getRowAvailable(r) <= 5;
              })
              .sort((a, b) => {
                if (selectedLocationId === "all" && hasLocations) {
                  return getMinLocationStock(a) - getMinLocationStock(b);
                }
                return getRowAvailable(a) - getRowAvailable(b);
              })
              .slice(0, 10)
              .map((row) => {
                const isOut = selectedLocationId === "all" && hasLocations
                  ? isOutAtAnyLocation(row)
                  : getRowAvailable(row) === 0;
                const avail = selectedLocationId === "all" && hasLocations
                  ? getMinLocationStock(row)
                  : getRowAvailable(row);
                return (
                  <div key={row.rowId} className="px-5 py-3 flex items-center gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${isOut ? "bg-red-500" : "bg-amber-500"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {row.product_name}
                        {row.variant_title && (
                          <span className="text-gray-500 font-normal"> — {row.variant_title}</span>
                        )}
                      </p>
                      {row.sku && (
                        <p className="text-[10px] text-gray-500 font-mono">{row.sku}</p>
                      )}
                    </div>
                    <span className={`text-xs font-bold whitespace-nowrap ${isOut ? "text-red-600" : "text-amber-600"}`}>
                      {avail} in stock
                      {selectedLocationId === "all" && hasLocations && (() => {
                        // Find the location(s) with issues
                        const problemLocs = locations
                          .filter((loc) => {
                            const ls = row.location_stock.find((l) => l.location_id === loc.id);
                            return !ls || ls.available === 0;
                          })
                          .map((loc) => loc.name.split(" ")[0]);
                        if (problemLocs.length > 0 && problemLocs.length < locations.length) {
                          return <span className="text-[10px] text-gray-500 font-normal ml-1">({problemLocs.join(", ")})</span>;
                        }
                        return null;
                      })()}
                    </span>
                    <button
                      onClick={() => openAdjustModal(row._item, row.variant_id)}
                      className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 flex-shrink-0"
                    >
                      Adjust
                    </button>
                  </div>
                );
              })}
          </div>
        </details>
      )}

      {/* Search & filter */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <svg className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search by product name, variant, or SKU..."
              className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
            />
          </div>
          <div className="flex gap-1">
            {([
              { key: "all" as const, label: "All" },
              { key: "low" as const, label: "Low Stock" },
              { key: "out" as const, label: "Out of Stock" },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setFilter(key); setCurrentPage(1); }}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition ${
                  filter === key
                    ? "bg-indigo-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="mt-3 flex items-center gap-3 border-t border-gray-100 pt-3">
            <span className="text-xs text-gray-500 font-medium">
              {selectedIds.size} selected
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Set stock to</span>
              <input
                type="number"
                min="0"
                value={bulkQty}
                onChange={(e) => setBulkQty(e.target.value)}
                placeholder="0"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-28"
              />
              <button
                onClick={handleBulkUpdate}
                disabled={bulkSaving || !bulkQty}
                className="bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 transition"
              >
                {bulkSaving ? "Updating..." : "Bulk Update"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Inventory Table (Shopify-style flat rows) ────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleAll}
                    className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-300"
                  />
                </th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">SKU</th>
                {hasLocations && selectedLocationId === "all" ? (
                  <>
                    <th className="py-3 px-4 text-right">Available</th>
                    <th className="py-3 px-4 text-right">Committed</th>
                    <th className="py-3 px-4 text-right">Incoming</th>
                    <th className="py-3 px-4 text-right">On hand</th>
                  </>
                ) : hasLocations ? (
                  <>
                    <th className="py-3 px-4 text-right">Available</th>
                    <th className="py-3 px-4 text-right">Committed</th>
                    <th className="py-3 px-4 text-right">Incoming</th>
                    <th className="py-3 px-4 text-right">On hand</th>
                  </>
                ) : (
                  <th className="py-3 px-4 text-right">Available</th>
                )}
                <th className="py-3 px-4 whitespace-nowrap min-w-[90px]">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={hasLocations ? 9 : 6}
                    className="py-16 text-center text-sm text-gray-400"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <svg className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <p>No inventory items found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((row, idx) => {
                  const details = getRowStockDetails(row);
                  const status = stockStatus(details.available);
                  const isVariantRow = row.variant_title !== null;

                  // Check if this is a new product group or continuation
                  const prevRow = idx > 0 ? paginatedItems[idx - 1] : null;
                  const isNewGroup = !prevRow || prevRow.listing_id !== row.listing_id;

                  return (
                    <tr
                      key={row.rowId}
                      className={`hover:bg-gray-50/70 transition ${
                        isVariantRow && !isNewGroup ? "border-t-0" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.rowId)}
                          onChange={() => toggleSelect(row.rowId)}
                          className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-300"
                        />
                      </td>
                      <td className="py-3 px-4">
                        {isVariantRow ? (
                          isNewGroup ? (
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{row.product_name}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{row.variant_title}</p>
                            </div>
                          ) : (
                            <div className="pl-6">
                              <p className="text-sm text-gray-600">{row.variant_title}</p>
                            </div>
                          )
                        ) : (
                          <p className="font-medium text-gray-900">{row.product_name}</p>
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
                      {hasLocations ? (
                        <>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`font-semibold ${
                                status === "out"
                                  ? "text-red-600"
                                  : status === "low"
                                  ? "text-amber-600"
                                  : "text-gray-900"
                              }`}
                            >
                              {details.available}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-gray-600">{details.committed}</td>
                          <td className="py-3 px-4 text-right text-gray-600">{details.incoming}</td>
                          <td className="py-3 px-4 text-right font-medium text-gray-900">{details.onHand}</td>
                        </>
                      ) : (
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`font-semibold ${
                              status === "out"
                                ? "text-red-600"
                                : status === "low"
                                ? "text-amber-600"
                                : "text-gray-900"
                            }`}
                          >
                            {details.available}
                          </span>
                        </td>
                      )}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            !row.is_available
                              ? "bg-gray-100 text-gray-500"
                              : status === "in_stock"
                              ? "bg-green-100 text-green-800"
                              : status === "low"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {!row.is_available
                            ? "Unavailable"
                            : status === "in_stock"
                            ? "In stock"
                            : status === "low"
                            ? "Low stock"
                            : "Out of stock"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openAdjustModal(row._item, row.variant_id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Adjust
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Link
          href="/seller/products/inventory/adjustments"
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          View adjustment history
        </Link>
        <div className="flex-1">
          <Pagination
            currentPage={currentPage}
            totalItems={filtered.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
            itemLabel="items"
          />
        </div>
      </div>

      {/* ── Stock Adjustment Modal ──────────────────────────────────── */}
      {adjustItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeAdjustModal}
          />
          <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl border border-gray-200 mx-4">
            <div className="sticky top-0 bg-white border-b border-gray-200 rounded-t-2xl px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Adjust Stock</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {adjustItem.product_name}
                  {adjustItem.sku && (
                    <span className="ml-2 inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono font-medium text-gray-600">
                      {adjustItem.sku}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={closeAdjustModal}
                className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 pt-4">
              <div className="grid grid-cols-5 gap-1.5">
                {ADJUST_MODES.map((m) => {
                  const active = adjustMode === m.value;
                  const colors: Record<string, string> = {
                    set: "border-indigo-500 bg-indigo-50 text-indigo-700",
                    add: "border-green-500 bg-green-50 text-green-700",
                    remove: "border-orange-500 bg-orange-50 text-orange-700",
                    damaged: "border-red-500 bg-red-50 text-red-700",
                    missing: "border-amber-500 bg-amber-50 text-amber-700",
                  };
                  return (
                    <button
                      key={m.value}
                      onClick={() => {
                        setAdjustMode(m.value);
                        // Auto-set the reason for each mode
                        setAdjustEntries((prev) =>
                          prev.map((e) => ({ ...e, reason: m.defaultReason, value: "0" }))
                        );
                      }}
                      className={`flex flex-col items-center gap-0.5 rounded-lg border-2 px-2 py-2 text-xs font-medium transition ${
                        active
                          ? colors[m.value]
                          : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <span className="text-base font-bold leading-none">{m.icon}</span>
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-gray-400">
                {ADJUST_MODES.find((m) => m.value === adjustMode)?.desc}
              </p>
            </div>

            <div className="px-6 py-4 space-y-5">
              {adjustEntries.map((entry, idx) => {
                const preview = getPreview(entry);
                const deltaStr =
                  preview.delta > 0
                    ? `+${preview.delta}`
                    : preview.delta < 0
                    ? String(preview.delta)
                    : "0";
                const deltaColor =
                  preview.delta > 0
                    ? "text-green-600"
                    : preview.delta < 0
                    ? "text-red-600"
                    : "text-gray-400";

                return (
                  <div key={entry.location_id} className="space-y-3">
                    {adjustEntries.length > 1 && (
                      <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-sm font-semibold text-gray-700">
                          {entry.location_name}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Current available
                        </label>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
                          {entry.current_available}
                        </div>
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          {adjustMode === "set" ? "New quantity" :
                           adjustMode === "add" ? "Quantity to add" :
                           adjustMode === "remove" ? "Quantity to remove" :
                           adjustMode === "damaged" ? "Damaged units" :
                           "Missing units"}
                        </label>
                        <input
                          type="number"
                          value={entry.value}
                          onChange={(e) => updateAdjustEntry(idx, { value: e.target.value })}
                          min={0}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 flex items-center gap-2 text-sm">
                      <span className="text-gray-500">Preview:</span>
                      <span className="font-medium text-gray-700">
                        {entry.current_available}
                      </span>
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <span className="font-bold text-gray-900">
                        {preview.newValue}
                      </span>
                      <span className={`text-xs font-medium ${deltaColor}`}>
                        ({deltaStr})
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Reason
                      </label>
                      <select
                        value={entry.reason}
                        onChange={(e) =>
                          updateAdjustEntry(idx, { reason: e.target.value as AdjustmentReason })
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-300/30 outline-none"
                      >
                        {REASON_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Notes <span className="text-gray-400">(optional)</span>
                      </label>
                      <textarea
                        value={entry.notes}
                        onChange={(e) => updateAdjustEntry(idx, { notes: e.target.value })}
                        rows={2}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none resize-none"
                        placeholder="Add a note about this adjustment..."
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 rounded-b-2xl px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={closeAdjustModal}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAdjustment}
                disabled={adjustSaving}
                className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50 transition"
              >
                {adjustSaving ? "Saving..." : "Save adjustment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-6 right-6 z-[9999]">
          <div className={`flex items-center gap-3 rounded-lg border px-5 py-3.5 shadow-lg ${toast.type === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
            <span className="text-lg">{toast.type === "success" ? "✓" : "✕"}</span>
            <span className="text-sm font-medium">{toast.message}</span>
            <button onClick={() => { if (toastTimer.current) clearTimeout(toastTimer.current); setToast(null); }} className="ml-2 text-current opacity-50 hover:opacity-100">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
