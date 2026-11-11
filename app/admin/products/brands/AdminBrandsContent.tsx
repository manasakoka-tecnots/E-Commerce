"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";

type Brand = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  category: string | null;
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
    fd.append("entityType", "brands");

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
          <img src={preview} alt="" className="h-full w-full object-contain" />
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

function slugify(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function AdminBrandsContent() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add form
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newLogoUrl, setNewLogoUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const loadBrands = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, slug, logo_url, description, category, created_at")
        .order("name", { ascending: true });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      // Get product counts per brand
      const enriched: Brand[] = await Promise.all(
        (data || []).map(async (b) => {
          const { count } = await supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("brand", b.name);
          return { ...b, products_count: count ?? 0 };
        })
      );

      setBrands(enriched);
    } catch {
      setErrorMessage("Failed to load brands.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadBrands();
  }, [loadBrands]);

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  };

  const createBrand = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setErrorMessage(null);

    const token = await getToken();
    const res = await fetch("/api/update-brand", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        brand: {
          name: newName.trim(),
          slug: slugify(newName),
          logo_url: newLogoUrl || null,
          description: newDescription.trim() || `Products from ${newName.trim()}`,
          category: newCategory.trim() || "Other",
        },
      }),
    });

    setCreating(false);
    const json = await res.json();

    if (!res.ok) {
      setErrorMessage(json.error || "Failed to create brand");
      return;
    }

    setNewName("");
    setNewCategory("");
    setNewDescription("");
    setNewLogoUrl(null);
    void loadBrands();
  };

  const updateBrand = async (id: string) => {
    if (!editName.trim()) return;
    setWorkingId(id);
    setErrorMessage(null);

    const oldBrand = brands.find((b) => b.id === id);
    const token = await getToken();
    const res = await fetch("/api/update-brand", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        brandId: id,
        oldName: oldBrand?.name,
        updates: {
          name: editName.trim(),
          slug: slugify(editName),
          logo_url: editLogoUrl || null,
          description: editDescription.trim() || null,
          category: editCategory.trim() || "Other",
        },
      }),
    });

    setWorkingId(null);
    const json = await res.json();

    if (!res.ok) {
      setErrorMessage(json.error || "Failed to update brand");
      return;
    }

    setEditingId(null);
    setBrands((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              name: editName.trim(),
              slug: slugify(editName),
              logo_url: editLogoUrl,
              description: editDescription.trim() || null,
              category: editCategory.trim() || "Other",
            }
          : b
      )
    );
  };

  const deleteBrand = async (id: string) => {
    if (!confirm("Are you sure you want to delete this brand?")) return;
    setWorkingId(id);
    setErrorMessage(null);

    const token = await getToken();
    const res = await fetch("/api/update-brand", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ brandId: id }),
    });

    setWorkingId(null);
    const json = await res.json();

    if (!res.ok) {
      setErrorMessage(json.error || "Failed to delete brand");
      return;
    }

    setBrands((prev) => prev.filter((b) => b.id !== id));
  };

  const inputClass =
    "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-200";

  const uniqueCategories = Array.from(new Set(brands.map((b) => b.category).filter(Boolean)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Brands</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage brands across the marketplace
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Add brand form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">Add Brand</h2>
        <div className="space-y-3">
          <div className="flex items-end gap-3">
            <ImageUploader currentImage={newLogoUrl} onUploaded={setNewLogoUrl} label="Logo" />
            <input
              type="text"
              className={`${inputClass} flex-1`}
              placeholder="Brand name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              type="text"
              className={`${inputClass} w-48`}
              placeholder="Category (e.g. Electronics)"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              list="brand-categories"
            />
            <datalist id="brand-categories">
              {uniqueCategories.map((c) => (
                <option key={c} value={c!} />
              ))}
            </datalist>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              className={`${inputClass} flex-1`}
              placeholder="Description (optional)..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
            <button
              onClick={() => void createBrand()}
              disabled={creating || !newName.trim()}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {creating ? "Adding..." : "Add Brand"}
            </button>
          </div>
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
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Logo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Products</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {brands.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      No brands yet. Add one above.
                    </td>
                  </tr>
                ) : (
                  brands.map((brand) => (
                    <tr key={brand.id} className="hover:bg-gray-50/60 transition">
                      <td className="px-4 py-3">
                        {editingId === brand.id ? (
                          <ImageUploader currentImage={editLogoUrl} onUploaded={setEditLogoUrl} />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                            {brand.logo_url ? (
                              <img
                                src={brand.logo_url}
                                alt={brand.name}
                                className="h-full w-full object-contain p-1"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <span className="text-sm font-bold text-gray-400">
                                {brand.name[0]}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === brand.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              className={`${inputClass} w-full`}
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="Brand name"
                              autoFocus
                            />
                            <input
                              type="text"
                              className={`${inputClass} w-full`}
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              placeholder="Description"
                            />
                          </div>
                        ) : (
                          <div>
                            <span className="font-medium text-gray-900">{brand.name}</span>
                            {brand.description && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                {brand.description}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === brand.id ? (
                          <input
                            type="text"
                            className={`${inputClass} w-36`}
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            placeholder="Category"
                            list="brand-categories-edit"
                          />
                        ) : (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                            {brand.category || "Other"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {brand.products_count}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editingId === brand.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => void updateBrand(brand.id)}
                              disabled={workingId === brand.id}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(null);
                                setEditName("");
                                setEditLogoUrl(null);
                                setEditCategory("");
                                setEditDescription("");
                              }}
                              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingId(brand.id);
                                setEditName(brand.name);
                                setEditLogoUrl(brand.logo_url);
                                setEditCategory(brand.category || "");
                                setEditDescription(brand.description || "");
                              }}
                              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => void deleteBrand(brand.id)}
                              disabled={workingId === brand.id}
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
          <datalist id="brand-categories-edit">
            {uniqueCategories.map((c) => (
              <option key={c} value={c!} />
            ))}
          </datalist>
        </div>
      )}
    </div>
  );
}
