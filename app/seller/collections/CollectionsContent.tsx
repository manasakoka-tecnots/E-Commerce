"use client";

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/src/lib/supabase/client";
import { useStaff } from "@/src/context/StaffContext";
import Spinner from "@/src/components/Spinner";
import Pagination, { usePagination } from "@/src/components/Pagination";

type Collection = {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  sort_order: string;
  is_active: boolean;
  created_at: string;
  product_count?: number; // computed client-side from collection_products
};

type SimpleProduct = {
  id: string;
  name: string;
};

export default function CollectionsContent() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const { sellerId: staffSellerId } = useStaff();

  // Form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const getSellerId = useCallback(async () => {
    if (staffSellerId) return staffSellerId;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;
    // Look up seller via profiles table (matches RLS function get_seller_id_for_user)
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
  }, [staffSellerId]);

  const loadCollections = useCallback(async () => {
    setLoading(true);
    const sellerId = await getSellerId();

    const { data, error: fetchErr } = await supabase
      .from("collections")
      .select("*, collection_products(id)")
      .eq("seller_id", sellerId)
      .order("created_at", { ascending: false });

    if (fetchErr) {
      setError(fetchErr.message);
    } else {
      const withCounts = (data ?? []).map((c) => ({
        ...(c as unknown as Collection),
        product_count: Array.isArray(c.collection_products) ? c.collection_products.length : 0,
        collection_products: undefined,
      }));
      setCollections(withCounts);
    }

    // Load products for selection
    const realSellerId = await getSellerId();
    if (realSellerId) {
      const { data: prods } = await supabase
        .from("products")
        .select("id, name")
        .eq("seller_id", realSellerId)
        .order("name");
      setProducts(prods ?? []);
    } else {
      const { data: prods } = await supabase
        .from("products")
        .select("id, name")
        .order("name")
        .limit(100);
      setProducts(prods ?? []);
    }

    setLoading(false);
  }, [getSellerId, getSellerId]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setImageFile(null);
    setImagePreview(null);
    setSelectedProducts([]);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const sellerId = await getSellerId();

    let imageUrl: string | null = imagePreview;

    // Upload image if new file selected
    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `sellers/${sellerId}/collections/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("store-assets")
        .upload(path, imageFile, { upsert: true });

      if (upErr) {
        // Image upload may fail without auth — continue without image
        console.warn("Image upload skipped:", upErr.message);
      } else {
        const { data: urlData } = supabase.storage.from("store-assets").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }
    }

    if (editingId) {
      const { error: updErr } = await supabase
        .from("collections")
        .update({
          title,
          description,
          image_url: imageUrl,
        })
        .eq("id", editingId);

      if (updErr) {
        setError(updErr.message);
      } else {
        // Update product-collection associations
        await supabase.from("collection_products").delete().eq("collection_id", editingId);
        if (selectedProducts.length > 0) {
          await supabase.from("collection_products").insert(
            selectedProducts.map((pid) => ({
              collection_id: editingId,
              product_id: pid,
            }))
          );
        }
        setSuccess("Collection updated!");
        resetForm();
        loadCollections();
      }
    } else {
      const { data: newColl, error: insertErr } = await supabase
        .from("collections")
        .insert({
          seller_id: sellerId,
          title,
          description,
          image_url: imageUrl,
          sort_order: String(collections.length),
        })
        .select()
        .single();

      if (insertErr) {
        setError(insertErr.message);
      } else {
        if (selectedProducts.length > 0 && newColl) {
          await supabase.from("collection_products").insert(
            selectedProducts.map((pid) => ({
              collection_id: newColl.id,
              product_id: pid,
            }))
          );
        }
        setSuccess("Collection created!");
        resetForm();
        loadCollections();
      }
    }
    setSubmitting(false);
  };

  const handleEdit = async (c: Collection) => {
    setEditingId(c.id);
    setTitle(c.title);
    setDescription(c.description ?? "");
    setImagePreview(c.image_url);
    setImageFile(null);

    // Load associated products
    const { data: cpData } = await supabase
      .from("collection_products")
      .select("product_id")
      .eq("collection_id", c.id);

    setSelectedProducts(cpData?.map((cp) => cp.product_id) ?? []);
    setShowForm(true);
  };

  const ITEMS_PER_PAGE = 8;
  const { currentPage, setCurrentPage, paginatedItems: paginatedCollections } = usePagination(collections, ITEMS_PER_PAGE);

  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this collection?")) return;
    setDeleting(id);
    setError(null);
    try {
      // Delete junction rows first (also handled by ON DELETE CASCADE, but explicit is safer)
      const { error: cpErr } = await supabase
        .from("collection_products")
        .delete()
        .eq("collection_id", id);
      if (cpErr) console.warn("collection_products delete:", cpErr.message);

      const { error: delErr } = await supabase
        .from("collections")
        .delete()
        .eq("id", id);

      if (delErr) {
        setError(delErr.message);
      } else {
        setCollections((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete collection");
    } finally {
      setDeleting(null);
    }
  };

  const toggleProduct = (pid: string) => {
    setSelectedProducts((prev) =>
      prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]
    );
  };

  return (
      <div className="min-h-screen bg-gray-50 p-6 md:p-10">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Collections</h1>
              <p className="mt-1 text-sm text-gray-500">
                Organize your products into collections for your storefront.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex rounded-lg border border-gray-200 bg-white">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`px-3 py-1.5 text-xs font-medium ${
                    viewMode === "grid"
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-3 py-1.5 text-xs font-medium ${
                    viewMode === "list"
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  List
                </button>
              </div>
              <button
                onClick={() => {
                  if (showForm) resetForm();
                  else setShowForm(true);
                }}
                className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600"
              >
                {showForm ? "Cancel" : "Create Collection"}
              </button>
            </div>
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

          {/* Create / Edit Form */}
          {showForm && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                {editingId ? "Edit Collection" : "New Collection"}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    placeholder="Summer Collection"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    placeholder="Describe this collection..."
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Collection Image
                  </label>
                  <div className="flex items-center gap-4">
                    {(imagePreview || imageFile) && (
                      <div className="h-16 w-16 overflow-hidden rounded-lg border border-gray-200">
                        <img
                          src={
                            imageFile
                              ? URL.createObjectURL(imageFile)
                              : imagePreview ?? ""
                          }
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <label className="cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50">
                      {imagePreview || imageFile ? "Change Image" : "Upload Image"}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            setImageFile(f);
                            setImagePreview(null);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Product Selection */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Select Products ({selectedProducts.length} selected)
                  </label>
                  {products.length === 0 ? (
                    <p className="text-sm text-gray-400">
                      No products found. Create products first.
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
                      {products.map((p) => (
                        <label
                          key={p.id}
                          className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedProducts.includes(p.id)}
                            onChange={() => toggleProduct(p.id)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-500 focus:ring-indigo-300"
                          />
                          <span className="text-sm text-gray-700">{p.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
                >
                  {submitting
                    ? "Saving..."
                    : editingId
                      ? "Update Collection"
                      : "Create Collection"}
                </button>
              </form>
            </div>
          )}

          {/* Collections Display */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner />
            </div>
          ) : collections.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm">
              <svg
                className="mx-auto mb-4 h-12 w-12 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z"
                />
              </svg>
              <h3 className="text-sm font-medium text-gray-900">No collections yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Create collections to organize and showcase your products.
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedCollections.map((c) => (
                <div
                  key={c.id}
                  className="group rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
                >
                  <div className="flex h-40 items-center justify-center bg-gray-50">
                    {c.image_url ? (
                      <img
                        src={c.image_url}
                        alt={c.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <svg
                        className="h-10 w-10 text-gray-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-gray-900">{c.title}</h3>
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                      <span>{c.product_count} products</span>
                      <span>Sort: {c.sort_order}</span>
                    </div>
                    {c.description && (
                      <p className="mt-2 line-clamp-2 text-xs text-gray-500">{c.description}</p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleEdit(c)}
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={deleting === c.id}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {deleting === c.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Pagination currentPage={currentPage} totalItems={collections.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} itemLabel="collections" />
            </>
          ) : (
            <>
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 font-medium text-gray-700">Image</th>
                      <th className="px-4 py-3 font-medium text-gray-700">Title</th>
                      <th className="px-4 py-3 font-medium text-gray-700">Products</th>
                      <th className="px-4 py-3 font-medium text-gray-700">Sort Order</th>
                      <th className="px-4 py-3 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedCollections.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="h-10 w-10 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                            {c.image_url ? (
                              <img
                                src={c.image_url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{c.title}</td>
                        <td className="px-4 py-3 text-gray-600">{c.product_count}</td>
                        <td className="px-4 py-3 text-gray-600">{c.sort_order}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(c)}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium hover:bg-gray-50"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(c.id)}
                              disabled={deleting === c.id}
                              className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              {deleting === c.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <Pagination currentPage={currentPage} totalItems={collections.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} itemLabel="collections" />
            </>
          )}
        </div>
      </div>
  );
}
