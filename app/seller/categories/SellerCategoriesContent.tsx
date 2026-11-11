"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";
import Pagination, { usePagination } from "@/src/components/Pagination";

interface Category {
  id: string;
  name: string;
  image_url: string | null;
  created_at: string;
  product_count?: number;
}

export default function SellerCategoriesContent() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newImage, setNewImage] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchAllCategories = useCallback(async () => {
    const { data: cats } = await supabase
      .from("categories")
      .select("id, name, image_url, created_at")
      .order("name");

    if (cats) {
      const { data: products } = await supabase
        .from("products")
        .select("category_id");

      const countMap = new Map<string, number>();
      if (products) {
        for (const p of products) {
          if (p.category_id) {
            countMap.set(p.category_id, (countMap.get(p.category_id) || 0) + 1);
          }
        }
      }

      setCategories(
        cats.map((c: { id: string; name: string; image_url: string | null; created_at: string }) => ({
          ...c,
          product_count: countMap.get(c.id) || 0,
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAllCategories();
  }, [fetchAllCategories]);

  const CATEGORIES_PER_PAGE = 8;

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const { currentPage, setCurrentPage, paginatedItems: paginatedCategories } = usePagination(filtered, CATEGORIES_PER_PAGE);

  // Reset page when search changes
  useEffect(() => { setCurrentPage(1); }, [search, setCurrentPage]);

  // Track object URLs for cleanup
  const objectUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  const handleImageSelect = (
    file: File | null,
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void
  ) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be under 2MB.");
      return;
    }
    setFile(file);
    const url = URL.createObjectURL(file);
    objectUrlsRef.current.push(url);
    setPreview(url);
    setError("");
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("entityType", "categories");
    try {
      const res = await fetch("/api/upload-entity-image", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.path) {
        return data.path;
      }
      setError(data.error || "Image upload failed");
    } catch {
      setError("Image upload failed. Please try again.");
    }
    return null;
  };

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    const exists = categories.some(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setError(`Category "${trimmed}" already exists.`);
      return;
    }

    setAdding(true);
    setError("");

    let imageUrl: string | null = null;
    if (newImage) {
      imageUrl = await uploadImage(newImage);
      if (!imageUrl) { setAdding(false); return; }
    }

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/update-category", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "add", name: trimmed, image_url: imageUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to add category");
      } else {
        setNewName("");
        setNewImage(null);
        setNewImagePreview(null);
        setShowAdd(false);
        await fetchAllCategories();
      }
    } catch {
      setError("Failed to add category");
    }
    setAdding(false);
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditImage(null);
    setEditImagePreview(cat.image_url || null);
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditImage(null);
    setEditImagePreview(null);
    setError("");
  };

  const handleSaveEdit = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;

    const exists = categories.some(
      (c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setError(`Category "${trimmed}" already exists.`);
      return;
    }

    setSaving(true);
    setError("");

    let imageUrl: string | undefined = undefined;
    if (editImage) {
      const uploaded = await uploadImage(editImage);
      if (!uploaded) { setSaving(false); return; }
      imageUrl = uploaded;
    }

    const payload: Record<string, unknown> = {
      action: "update",
      categoryId: id,
      name: trimmed,
    };
    // Only send image_url if a new image was uploaded or explicitly removed
    if (imageUrl !== undefined) {
      payload.image_url = imageUrl;
    } else if (editImagePreview === null && categories.find((c) => c.id === id)?.image_url) {
      // Image was removed
      payload.image_url = null;
    }

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/update-category", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to update category");
        setSaving(false);
        return;
      }
    } catch {
      setError("Failed to update category");
      setSaving(false);
      return;
    }
    cancelEdit();
    setSaving(false);
    await fetchAllCategories();
  };

  const handleDelete = async (id: string, name: string, count: number) => {
    if (count > 0) {
      if (
        !confirm(
          `Category "${name}" has ${count} product(s). Deleting it will unset the category for those products. Continue?`
        )
      )
        return;
    } else {
      if (!confirm(`Delete category "${name}"?`)) return;
    }
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/update-category", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "delete", categoryId: id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to delete category");
        return;
      }
    } catch {
      setError("Failed to delete category");
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage product categories. {categories.length} total
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Category
        </button>
      </div>

      {/* Add Category Form */}
      {showAdd && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Add New Category</h3>
          {error && !editingId && (
            <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Image
              </label>
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
                  {newImagePreview ? (
                    <img src={newImagePreview} alt="Preview" className="h-12 w-12 object-cover rounded-md" />
                  ) : (
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition text-center">
                    Choose
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageSelect(e.target.files?.[0] || null, setNewImage, setNewImagePreview)}
                    />
                  </label>
                  {newImagePreview && (
                    <button
                      type="button"
                      onClick={() => { setNewImage(null); setNewImagePreview(null); }}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Category Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="e.g. Electronics"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleAdd}
              disabled={adding || !newName.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {adding ? "Adding..." : "Add Category"}
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setNewName("");
                setNewImage(null);
                setNewImagePreview(null);
                setError("");
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit Error */}
      {error && editingId && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories..."
            className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
          />
        </div>
      </div>

      {/* Categories Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading categories...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {search
              ? `No categories match "${search}"`
              : "No categories yet. Add your first category!"}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Category
                </th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">
                  Products
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedCategories.map((cat) =>
                editingId === cat.id ? (
                  <tr
                    key={cat.id}
                    className="border-b border-gray-100 last:border-0 bg-indigo-50/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <label className="relative cursor-pointer group">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 group-hover:ring-2 group-hover:ring-indigo-300 transition">
                            {editImagePreview ? (
                              <img src={editImagePreview} alt={editName} className="h-10 w-10 object-cover rounded-lg" />
                            ) : (
                              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            )}
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg opacity-0 group-hover:opacity-100 transition">
                            <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleImageSelect(e.target.files?.[0] || null, setEditImage, setEditImagePreview)}
                          />
                        </label>
                        {editImagePreview && (
                          <button
                            type="button"
                            onClick={() => { setEditImage(null); setEditImagePreview(null); }}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Remove
                          </button>
                        )}
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(cat.id);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          autoFocus
                          className="flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        {cat.product_count || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleSaveEdit(cat.id)}
                          disabled={saving || !editName.trim()}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition"
                        >
                          {saving ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={cat.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                          {cat.image_url ? (
                            <img src={cat.image_url} alt={cat.name} className="h-10 w-10 object-cover rounded-lg" />
                          ) : (
                            <span className="text-sm font-bold text-gray-400">{cat.name[0]}</span>
                          )}
                        </div>
                        <span className="font-medium text-gray-900">{cat.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        {cat.product_count || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => startEdit(cat)}
                          className="text-indigo-600 hover:text-indigo-800 text-xs font-medium transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() =>
                            handleDelete(cat.id, cat.name, cat.product_count || 0)
                          }
                          className="text-red-500 hover:text-red-700 text-xs font-medium transition"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={filtered.length}
        itemsPerPage={CATEGORIES_PER_PAGE}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
