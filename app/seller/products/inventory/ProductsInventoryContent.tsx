"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";
import Pagination, { usePagination } from "@/src/components/Pagination";

type InventoryItem = {
  listing_id: string;
  product_id: string;
  product_name: string;
  sku: string | null;
  stock: number;
  low_stock_threshold: number;
  track_quantity: boolean;
  status: string;
};

export default function ProductsInventoryContent() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [bulkQty, setBulkQty] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);

  const loadInventory = useCallback(async (sid: string) => {
    const { data: listings } = await supabase
      .from("seller_listings")
      .select("id, product_id, stock, status, products(name)")
      .eq("seller_id", sid)
      .order("created_at", { ascending: false });

    if (!listings) return;

    const mapped: InventoryItem[] = listings.map((l: any) => {
      const prod = Array.isArray(l.products) ? l.products[0] : l.products;
      return {
        listing_id: l.id,
        product_id: l.product_id,
        product_name: prod?.name ?? "Untitled",
        sku: null,
        stock: Number(l.stock) || 0,
        low_stock_threshold: 5,
        track_quantity: true,
        status: l.status,
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
      await loadInventory(seller.id);
      setLoading(false);
    })();
  }, [loadInventory]);

  const updateStock = async (listingId: string, delta: number) => {
    setSaving(listingId);
    const item = items.find((i) => i.listing_id === listingId);
    if (!item) { setSaving(null); return; }

    const newStock = Math.max(0, item.stock + delta);
    const { error } = await supabase
      .from("seller_listings")
      .update({ stock: newStock })
      .eq("id", listingId);
    if (error) { alert("Failed to update stock: " + error.message); setSaving(null); return; }

    setItems((prev) =>
      prev.map((i) =>
        i.listing_id === listingId ? { ...i, stock: newStock } : i
      )
    );
    setSaving(null);
  };

  const handleBulkUpdate = async () => {
    if (!bulkQty || selectedIds.size === 0) return;
    setSaving("bulk");
    const qty = parseInt(bulkQty, 10);
    if (isNaN(qty) || qty < 0) { setSaving(null); return; }

    for (const id of selectedIds) {
      const { error } = await supabase
        .from("seller_listings")
        .update({ stock: qty })
        .eq("id", id);
      if (error) { alert("Failed to update stock for item: " + error.message); setSaving(null); return; }
    }

    setItems((prev) =>
      prev.map((i) =>
        selectedIds.has(i.listing_id) ? { ...i, stock: qty } : i
      )
    );
    setSelectedIds(new Set());
    setBulkQty("");
    setSaving(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((i) => i.listing_id)));
    }
  };

  const filtered = items.filter((i) => {
    const matchSearch =
      !search.trim() ||
      i.product_name.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ||
      (filter === "low" && i.stock > 0 && i.stock <= i.low_stock_threshold) ||
      (filter === "out" && i.stock === 0);
    return matchSearch && matchFilter;
  });

  const ITEMS_PER_PAGE = 8;
  const { currentPage, setCurrentPage, paginatedItems: paginatedFiltered } = usePagination(filtered, ITEMS_PER_PAGE);

  const lowStockCount = items.filter(
    (i) => i.stock > 0 && i.stock <= i.low_stock_threshold
  ).length;
  const outOfStockCount = items.filter((i) => i.stock === 0).length;

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
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage stock levels across all your products.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm text-gray-500">Total Products</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{items.length}</p>
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

      {/* Filter & search */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <svg className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
            />
          </div>
          <div className="flex gap-1">
            {(["all", "low", "out"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition ${
                  filter === f
                    ? "bg-indigo-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f === "all" ? "All" : f === "low" ? "Low Stock" : "Out of Stock"}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk update */}
        {selectedIds.size > 0 && (
          <div className="mt-3 flex items-center gap-3 border-t border-gray-100 pt-3">
            <span className="text-xs text-gray-500 font-medium">
              {selectedIds.size} selected
            </span>
            <input
              type="number"
              min="0"
              value={bulkQty}
              onChange={(e) => setBulkQty(e.target.value)}
              placeholder="Set stock to..."
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-40"
            />
            <button
              onClick={handleBulkUpdate}
              disabled={saving === "bulk"}
              className="bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
            >
              {saving === "bulk" ? "Updating..." : "Bulk Update"}
            </button>
          </div>
        )}
      </div>

      {/* Table */}
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
                <th className="py-3 px-4">Available</th>
                <th className="py-3 px-4">Low Stock Threshold</th>
                <th className="py-3 px-4">Track Quantity</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-gray-500">
                    No inventory items found.
                  </td>
                </tr>
              ) : (
                paginatedFiltered.map((item) => {
                  const isLow =
                    item.stock > 0 && item.stock <= item.low_stock_threshold;
                  const isOut = item.stock === 0;

                  return (
                    <tr key={item.listing_id} className="hover:bg-gray-50/70 transition">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.listing_id)}
                          onChange={() => toggleSelect(item.listing_id)}
                          className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-300"
                        />
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900">
                        {item.product_name}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs">
                        {item.sku ?? "--"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateStock(item.listing_id, -1)}
                            disabled={saving === item.listing_id || item.stock === 0}
                            className="h-7 w-7 flex items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 text-sm font-bold"
                          >
                            -
                          </button>
                          <span
                            className={`min-w-[2rem] text-center font-semibold ${
                              isOut
                                ? "text-red-600"
                                : isLow
                                ? "text-amber-600"
                                : "text-gray-900"
                            }`}
                          >
                            {item.stock}
                          </span>
                          <button
                            onClick={() => updateStock(item.listing_id, 1)}
                            disabled={saving === item.listing_id}
                            className="h-7 w-7 flex items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 text-sm font-bold"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {item.low_stock_threshold}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            item.track_quantity
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {item.track_quantity ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${
                            item.status === "active"
                              ? "bg-green-100 text-green-800"
                              : item.status === "archived"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination currentPage={currentPage} totalItems={filtered.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} itemLabel="items" />
    </div>
  );
}
