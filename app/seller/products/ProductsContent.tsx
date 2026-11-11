"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/src/lib/supabase/client";
import { getProductImageUrl } from "@/src/lib/catalog";
import Pagination, { usePagination } from "@/src/components/Pagination";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ProductListing = {
  id: string;
  product_id: string;
  price: number;
  stock: number;
  status: string;
  created_at: string;
  product: {
    name: string;
    brand: string | null;
    description: string | null;
    status: string;
  } | null;
  image_path: string | null;
  sku: string | null;
};

type StatusFilter = "all" | "active" | "draft" | "archived";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ProductsContent() {
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductListing[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 8;
  const [currentPage, setCurrentPage] = useState(1);

  const loadProducts = useCallback(async (sid: string) => {
    const { data: listings, error: listingsError } = await supabase
      .from("seller_listings")
      .select(
        "id, product_id, price, stock, status, created_at, products(name, brand, description, status)"
      )
      .eq("seller_id", sid)
      .order("created_at", { ascending: false });

    if (listingsError) {
      console.error("Failed to load listings:", listingsError.message);
      return;
    }

    const productItems: ProductListing[] = [];

    for (const listing of listings ?? []) {
      const prod = Array.isArray(listing.products)
        ? listing.products[0] ?? null
        : listing.products ?? null;

      /* Fetch first image for the product */
      let imagePath: string | null = null;
      const { data: imgData } = await supabase
        .from("product_images")
        .select("storage_path")
        .eq("product_id", listing.product_id)
        .order("is_representative", { ascending: false })
        .order("order", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (imgData) {
        imagePath = imgData.storage_path;
      }

      productItems.push({
        id: listing.id,
        product_id: listing.product_id,
        price: Number(listing.price) || 0,
        stock: Number(listing.stock) || 0,
        status: listing.status,
        created_at: listing.created_at,
        product: prod
          ? {
              name: (prod as { name: string }).name,
              brand: (prod as { brand: string | null }).brand,
              description: (prod as { description: string | null }).description,
              status: (prod as { status: string }).status,
            }
          : null,
        image_path: imagePath,
        sku: null,
      });
    }

    setProducts(productItems);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setAuthError("Please sign in to view your products.");
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("auth_uid", userData.user.id)
        .maybeSingle();

      if (!profile || (profile.role !== "seller" && profile.role !== "admin")) {
        setAuthError("You do not have seller permissions.");
        setLoading(false);
        return;
      }

      const { data: seller } = await supabase
        .from("sellers")
        .select("id, status")
        .eq("profile_id", profile.id)
        .maybeSingle();

      if (!seller || seller.status !== "approved") {
        setAuthError("Your seller account is not yet approved.");
        setLoading(false);
        return;
      }

      setSellerId(seller.id);
      await loadProducts(seller.id);
      setLoading(false);
    })();
  }, [loadProducts]);

  /* ---- derived data ---- */
  const getEffectiveStatus = (item: ProductListing): StatusFilter => {
    if (item.status === "archived") return "archived";
    if (
      item.status === "active" &&
      item.product?.status === "approved"
    )
      return "active";
    return "draft";
  };

  const counts = {
    all: products.length,
    active: products.filter((p) => getEffectiveStatus(p) === "active").length,
    draft: products.filter((p) => getEffectiveStatus(p) === "draft").length,
    archived: products.filter((p) => getEffectiveStatus(p) === "archived").length,
  };

  const filtered = products.filter((p) => {
    const matchesStatus =
      statusFilter === "all" || getEffectiveStatus(p) === statusFilter;
    const matchesSearch =
      !search.trim() ||
      (p.product?.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.product?.brand ?? "").toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const paginatedProducts = usePagination(filtered, currentPage, ITEMS_PER_PAGE);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  /* ---- actions ---- */
  const handleArchive = async (listingId: string) => {
    setActionLoading(listingId);
    const { error } = await supabase
      .from("seller_listings")
      .update({ status: "archived" })
      .eq("id", listingId);
    if (error) { alert("Failed to archive: " + error.message); setActionLoading(null); return; }
    setProducts((prev) =>
      prev.map((p) => (p.id === listingId ? { ...p, status: "archived" } : p))
    );
    setActionLoading(null);
  };

  const handleUnarchive = async (listingId: string) => {
    setActionLoading(listingId);
    const { error } = await supabase
      .from("seller_listings")
      .update({ status: "active" })
      .eq("id", listingId);
    if (error) { alert("Failed to restore: " + error.message); setActionLoading(null); return; }
    setProducts((prev) =>
      prev.map((p) => (p.id === listingId ? { ...p, status: "active" } : p))
    );
    setActionLoading(null);
  };

  const handleDelete = async (listingId: string, productId: string) => {
    if (!confirm("Are you sure you want to delete this product listing? This cannot be undone.")) return;
    setActionLoading(listingId);
    const { error: listErr } = await supabase.from("seller_listings").delete().eq("id", listingId);
    if (listErr) { alert("Failed to delete listing: " + listErr.message); setActionLoading(null); return; }
    const { error: prodErr } = await supabase.from("products").delete().eq("id", productId);
    if (prodErr) { alert("Failed to delete product: " + prodErr.message); setActionLoading(null); return; }
    setProducts((prev) => prev.filter((p) => p.id !== listingId));
    setActionLoading(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  };

  const formatRupee = (value: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const statusBadge = (status: StatusFilter) => {
    const styles: Record<StatusFilter, string> = {
      all: "",
      active: "bg-green-100 text-green-800",
      draft: "bg-gray-100 text-gray-600",
      archived: "bg-orange-100 text-orange-700",
    };
    return styles[status] || styles.draft;
  };

  /* ---- loading & auth states ---- */
  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-md text-center space-y-4">
          <p className="text-sm text-red-600 font-medium">{authError}</p>
          <Link
            href="/seller"
            className="inline-block bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-600"
          >
            Go to Seller Portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page header — Shopify style */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Products</h1>
        <div className="flex items-center gap-2">
          <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            Export
          </button>
          <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            Import
          </button>
          <Link
            href="/seller/products/new"
            className="bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-600 transition"
          >
            Add product
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        </div>
      ) : products.length === 0 && !search ? (
        /* Empty state — Shopify style */
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 px-8 text-center">
          <div className="mx-auto mb-6 w-28 h-28 flex items-center justify-center">
            <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              {/* Product box illustration */}
              <rect x="20" y="35" width="80" height="65" rx="6" fill="#F3F4F6" stroke="#D1D5DB" strokeWidth="2"/>
              <path d="M20 47C20 43.6863 22.6863 41 26 41H94C97.3137 41 100 43.6863 100 47V55H20V47Z" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="2"/>
              <rect x="50" y="41" width="20" height="14" rx="2" fill="#C7D2FE" stroke="#818CF8" strokeWidth="1.5"/>
              <line x1="60" y1="70" x2="60" y2="85" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round"/>
              <line x1="52" y1="77" x2="68" y2="77" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round"/>
              {/* Tag */}
              <rect x="70" y="18" width="28" height="20" rx="4" fill="#C7D2FE" stroke="#818CF8" strokeWidth="1.5" transform="rotate(12 70 18)"/>
              <circle cx="90" cy="24" r="2.5" fill="#818CF8"/>
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            First up: what are you selling?
          </h2>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            Before you open your store, first you need some products. Add your products manually or import them from a file.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              Import products
            </button>
            <Link
              href="/seller/products/new"
              className="rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-600 transition"
            >
              Add your products
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Status filter tabs */}
          <div className="flex gap-1 mb-4 border-b border-gray-200">
            {(["all", "active", "draft", "archived"] as StatusFilter[]).map(
              (tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition capitalize ${
                    statusFilter === tab
                      ? "border-indigo-500 text-indigo-500"
                      : "border-transparent text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {tab} ({counts[tab]})
                </button>
              )
            )}
          </div>

          {/* Search & bulk actions bar */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4">
              <div className="relative flex-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products by name or brand..."
                  className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                />
              </div>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">
                    {selectedIds.size} selected
                  </span>
                  <button className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                    Bulk archive
                  </button>
                  <button className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100">
                    Bulk delete
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Product table */}
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 mx-auto text-gray-300 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                No matching products
              </h3>
              <p className="text-sm text-gray-500">
                Try a different search term or filter.
              </p>
            </div>
            ) : (
              <>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4 w-10">
                          <input
                            type="checkbox"
                            checked={
                              filtered.length > 0 &&
                              selectedIds.size === filtered.length
                            }
                            onChange={toggleSelectAll}
                            className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-300"
                          />
                        </th>
                        <th className="py-3 px-4">Product</th>
                        <th className="py-3 px-4">SKU</th>
                        <th className="py-3 px-4">Price</th>
                        <th className="py-3 px-4">Stock</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Created</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedProducts.map((item) => {
                        const effStatus = getEffectiveStatus(item);
                        const imgUrl = getProductImageUrl(item.image_path);

                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-gray-50/70 transition"
                          >
                            <td className="py-3 px-4">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(item.id)}
                                onChange={() => toggleSelect(item.id)}
                                className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-300"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0">
                                  {imgUrl ? (
                                    <img
                                      src={imgUrl}
                                      alt={item.product?.name ?? "Product"}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center text-gray-400">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <Link
                                    href={`/seller/products/${item.product_id}/edit`}
                                    className="text-sm font-medium text-gray-900 hover:text-indigo-500 transition"
                                  >
                                    {item.product?.name ?? "Untitled product"}
                                  </Link>
                                  {item.product?.brand && (
                                    <p className="text-xs text-gray-500">
                                      {item.product.brand}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-gray-500 text-xs">
                              {item.sku ?? "--"}
                            </td>
                            <td className="py-3 px-4 font-semibold text-gray-900">
                              {formatRupee(item.price)}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`font-medium ${
                                  item.stock <= 0
                                    ? "text-red-600"
                                    : item.stock <= 5
                                    ? "text-orange-600"
                                    : "text-gray-700"
                                }`}
                              >
                                {item.stock}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${statusBadge(effStatus)}`}
                              >
                                {effStatus}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-gray-500 text-xs">
                              {formatDate(item.created_at)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Link
                                  href={`/seller/products/${item.product_id}/edit`}
                                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-500 hover:bg-indigo-50 transition"
                                >
                                  Edit
                                </Link>
                                {effStatus === "archived" ? (
                                  <button
                                    onClick={() => handleUnarchive(item.id)}
                                    disabled={actionLoading === item.id}
                                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50 transition disabled:opacity-50"
                                  >
                                    Unarchive
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleArchive(item.id)}
                                    disabled={actionLoading === item.id}
                                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-50 transition disabled:opacity-50"
                                  >
                                    Archive
                                  </button>
                                )}
                                <button
                                  onClick={() =>
                                    handleDelete(item.id, item.product_id)
                                  }
                                  disabled={actionLoading === item.id}
                                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-50"
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
              </div>
              <Pagination
                currentPage={currentPage}
                totalItems={filtered.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
                itemLabel="products"
              />
              </>
            )}
          </>
        )}
    </div>
  );
}
