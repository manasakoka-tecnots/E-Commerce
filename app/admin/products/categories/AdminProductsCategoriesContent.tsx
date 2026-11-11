"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";

type Category = {
  id: string;
  name: string;
  image_url: string | null;
  created_at: string;
  products_count: number;
};

function ImageUploader({
  currentImage,
  onUploaded,
  label,
}: {
  currentImage: string | null;
  onUploaded: (path: string | null) => void;
  label?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImage);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreview(currentImage);
  }, [currentImage]);

  const handleFile = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("entityType", "categories");

    try {
      const res = await fetch("/api/upload-entity-image", { method: "POST", body: fd });
      const json = await res.json();
      if (json.path) {
        setPreview(json.path);
        onUploaded(json.path);
      }
    } catch {
      // ignore
    }
    setUploading(false);
  };

  return (
    <div className="flex items-center gap-3">
      {label && <span className="text-xs text-gray-500 shrink-0">{label}</span>}
      <div
        onClick={() => inputRef.current?.click()}
        className="relative h-12 w-12 shrink-0 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition overflow-hidden"
      >
        {uploading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        ) : preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {preview && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPreview(null);
            onUploaded(null);
          }}
          className="text-xs text-red-500 hover:text-red-700"
        >
          Remove
        </button>
      )}
    </div>
  );
}

export default function AdminProductsCategoriesContent() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newImageUrl, setNewImageUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, image_url, created_at")
        .order("name", { ascending: true });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      const enriched: Category[] = await Promise.all(
        (data || []).map(async (cat) => {
          const { count } = await supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("category_id", cat.id);

          return {
            ...cat,
            products_count: count ?? 0,
          };
        })
      );

      setCategories(enriched);
    } catch {
      setErrorMessage("Failed to load categories.");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const createCategory = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setErrorMessage(null);

    const { error } = await supabase
      .from("categories")
      .insert({ name: newName.trim(), image_url: newImageUrl });

    setCreating(false);

    if (error) {
      setErrorMessage(`Failed to create category: ${error.message}`);
      return;
    }

    setNewName("");
    setNewImageUrl(null);
    void loadCategories();
  };

  const updateCategory = async (id: string) => {
    if (!editName.trim()) return;
    setWorkingId(id);
    setErrorMessage(null);

    const { error } = await supabase
      .from("categories")
      .update({ name: editName.trim(), image_url: editImageUrl })
      .eq("id", id);

    setWorkingId(null);

    if (error) {
      setErrorMessage(`Failed to update category: ${error.message}`);
      return;
    }

    setEditingId(null);
    setCategories((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, name: editName.trim(), image_url: editImageUrl } : c
      )
    );
    setEditName("");
    setEditImageUrl(null);
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    setWorkingId(id);
    setErrorMessage(null);

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", id);

    setWorkingId(null);

    if (error) {
      setErrorMessage(`Failed to delete category: ${error.message}`);
      return;
    }

    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  const inputClass =
    "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-200";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage product categories across the marketplace
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Add category form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">Add Category</h2>
        <div className="flex items-end gap-3">
          <ImageUploader
            currentImage={newImageUrl}
            onUploaded={setNewImageUrl}
            label="Image"
          />
          <input
            type="text"
            className={`${inputClass} flex-1`}
            placeholder="Category name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createCategory();
            }}
          />
          <button
            onClick={() => void createCategory()}
            disabled={creating || !newName.trim()}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {creating ? "Adding..." : "Add Category"}
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center p-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Image
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Name
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Products
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      No categories yet. Add one above.
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-gray-50/60 transition">
                      <td className="px-6 py-4">
                        {editingId === cat.id ? (
                          <ImageUploader
                            currentImage={editImageUrl}
                            onUploaded={setEditImageUrl}
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-gray-100 overflow-hidden">
                            {cat.image_url ? (
                              <img
                                src={cat.image_url}
                                alt={cat.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-gray-400">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingId === cat.id ? (
                          <div className="flex gap-2 items-center">
                            <input
                              type="text"
                              className={`${inputClass} w-64`}
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void updateCategory(cat.id);
                                if (e.key === "Escape") {
                                  setEditingId(null);
                                  setEditName("");
                                  setEditImageUrl(null);
                                }
                              }}
                              autoFocus
                            />
                            <button
                              onClick={() => void updateCategory(cat.id)}
                              disabled={workingId === cat.id}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(null);
                                setEditName("");
                                setEditImageUrl(null);
                              }}
                              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className="font-medium text-gray-900">{cat.name}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-700">
                        {cat.products_count}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {new Date(cat.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {editingId !== cat.id && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingId(cat.id);
                                setEditName(cat.name);
                                setEditImageUrl(cat.image_url);
                              }}
                              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => void deleteCategory(cat.id)}
                              disabled={workingId === cat.id}
                              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
