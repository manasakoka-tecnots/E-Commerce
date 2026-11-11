"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";
import Pagination, { usePagination } from "@/src/components/Pagination";

interface Brand {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  category: string | null;
  created_at: string;
}

export default function SellerBrandsContent() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategories, setNewCategories] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [showNewCatDropdown, setShowNewCatDropdown] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [newLogo, setNewLogo] = useState<File | null>(null);
  const [newLogoPreview, setNewLogoPreview] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [editCategoryInput, setEditCategoryInput] = useState("");
  const [showEditCatDropdown, setShowEditCatDropdown] = useState(false);
  const [editDescription, setEditDescription] = useState("");
  const [editLogo, setEditLogo] = useState<File | null>(null);
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchAllBrands = useCallback(async () => {
    const [{ data: brandsData }, { data: catsData }] = await Promise.all([
      supabase.from("brands").select("*").order("name"),
      supabase.from("categories").select("name").order("name"),
    ]);
    if (brandsData) setBrands(brandsData);
    if (catsData) setDbCategories(catsData.map((c: { name: string }) => c.name));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAllBrands();
  }, [fetchAllBrands]);

  const BRANDS_PER_PAGE = 8;

  const filtered = brands.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      (b.category || "").split(",").some(c => c.trim().toLowerCase().includes(search.toLowerCase()))
  );

  const { currentPage, setCurrentPage, paginatedItems: paginatedBrands } = usePagination(filtered, BRANDS_PER_PAGE);

  // Reset page when search changes
  useEffect(() => { setCurrentPage(1); }, [search, setCurrentPage]);

  // Track object URLs for cleanup
  const objectUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleLogoSelect = (
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

  const uploadLogo = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("entityType", "brands");
    try {
      const res = await fetch("/api/upload-entity-image", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.path) {
        return data.path;
      }
      setError(data.error || "Logo upload failed");
    } catch {
      setError("Logo upload failed. Please try again.");
    }
    return null;
  };

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    // Check for duplicates (case-insensitive)
    const exists = brands.some(
      (b) => b.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setError(`Brand "${trimmed}" already exists.`);
      return;
    }

    setAdding(true);
    setError("");
    const slug = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    let logoUrl: string | null = null;
    if (newLogo) {
      logoUrl = await uploadLogo(newLogo);
      if (!logoUrl) { setAdding(false); return; }
    }

    // Use server-side API to bypass RLS
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setError("Session expired. Please refresh and try again.");
      setAdding(false);
      return;
    }

    const res = await fetch("/api/update-brand", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        brand: {
          name: trimmed,
          slug,
          logo_url: logoUrl,
          category: newCategories.length > 0 ? newCategories.join(", ") : null,
          description: newDescription.trim() || null,
        },
      }),
    });

    let result: { error?: string } = {};
    try {
      result = await res.json();
    } catch {
      result = { error: "Failed to parse server response" };
    }

    if (!res.ok) {
      setError(
        result.error?.includes("already exists")
          ? `Brand "${trimmed}" already exists.`
          : result.error || "Failed to add brand"
      );
    } else {
      setNewName("");
      setNewCategories([]);
      setNewCategoryInput("");
      setNewDescription("");
      setNewLogo(null);
      setNewLogoPreview(null);
      setShowAdd(false);
      await fetchAllBrands();
    }
    setAdding(false);
  };

  const startEdit = (brand: Brand) => {
    setEditingId(brand.id);
    setEditName(brand.name);
    setEditCategories(brand.category ? brand.category.split(",").map(c => c.trim()).filter(Boolean) : []);
    setEditCategoryInput("");
    setEditDescription(brand.description || "");
    setEditLogo(null);
    setEditLogoPreview(brand.logo_url || null);
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditCategories([]);
    setEditCategoryInput("");
    setEditDescription("");
    setEditLogo(null);
    setEditLogoPreview(null);
    setError("");
  };

  const handleSaveEdit = async () => {
    const trimmed = editName.trim();
    if (!trimmed) return;

    // Check for duplicates (case-insensitive, excluding current brand)
    const exists = brands.some(
      (b) => b.id !== editingId && b.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setError(`Brand "${trimmed}" already exists.`);
      return;
    }

    setSaving(true);
    setError("");
    const slug = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    let logoUrl: string | undefined = undefined;
    if (editLogo) {
      const uploaded = await uploadLogo(editLogo);
      if (!uploaded) { setSaving(false); return; }
      logoUrl = uploaded;
    }

    const updateData: Record<string, unknown> = {
      name: trimmed,
      slug,
      category: editCategories.length > 0 ? editCategories.join(", ") : null,
      description: editDescription.trim() || null,
    };
    if (logoUrl !== undefined) {
      updateData.logo_url = logoUrl;
    } else if (editLogoPreview === null && brands.find((b) => b.id === editingId)?.logo_url) {
      // Logo was explicitly removed
      updateData.logo_url = null;
    }

    // Use server-side API to bypass RLS
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setError("Session expired. Please refresh and try again.");
      setSaving(false);
      return;
    }
    const res = await fetch("/api/update-brand", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        brandId: editingId,
        updates: updateData,
        oldName: brands.find((b) => b.id === editingId)?.name,
      }),
    });

    let result: { error?: string } = {};
    try {
      result = await res.json();
    } catch {
      result = { error: "Failed to parse server response" };
    }
    if (!res.ok) {
      setError(
        result.error?.includes("already exists")
          ? `Brand "${trimmed}" already exists.`
          : result.error || "Failed to update brand"
      );
    } else {
      setEditingId(null);
      await fetchAllBrands();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete brand "${name}"? Products using it will lose their brand.`))
      return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    const res = await fetch("/api/update-brand", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ brandId: id }),
    });
    let result: { error?: string } = {};
    try {
      result = await res.json();
    } catch {
      /* empty response */
    }
    if (res.ok) {
      setBrands((prev) => prev.filter((b) => b.id !== id));
    } else {
      setError(result.error || "Failed to delete brand");
    }
  };

  const categories = Array.from(
    new Set([
      ...dbCategories,
      ...brands.flatMap((b) => (b.category || "").split(",").map(c => c.trim())).filter(Boolean),
    ])
  ).sort();

  // Helper to add a category to a list
  const addCategory = (
    cat: string,
    selected: string[],
    setSelected: (cats: string[]) => void,
    setInput: (v: string) => void
  ) => {
    const trimmed = cat.trim();
    if (trimmed && !selected.includes(trimmed)) {
      setSelected([...selected, trimmed]);
    }
    setInput("");
  };

  // Helper to remove a category from a list
  const removeCategory = (
    cat: string,
    selected: string[],
    setSelected: (cats: string[]) => void
  ) => {
    setSelected(selected.filter(c => c !== cat));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Brands</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage brands available for your products. {brands.length} total
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Brand
        </button>
      </div>

      {/* Add Brand Form */}
      {showAdd && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Add New Brand</h3>
          {error && (
            <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Logo
              </label>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
                  {newLogoPreview ? (
                    <img src={newLogoPreview} alt="Preview" className="h-10 w-10 object-contain" />
                  ) : (
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
                <label className="cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition">
                  Choose
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLogoSelect(e.target.files?.[0] || null, setNewLogo, setNewLogoPreview)}
                  />
                </label>
                {newLogoPreview && (
                  <button
                    type="button"
                    onClick={() => { setNewLogo(null); setNewLogoPreview(null); }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Brand Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Nike"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Categories
              </label>
              {newCategories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {newCategories.map((cat) => (
                    <span key={cat} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                      {cat}
                      <button type="button" onClick={() => removeCategory(cat, newCategories, setNewCategories)} className="text-indigo-400 hover:text-indigo-600">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <input
                  type="text"
                  value={newCategoryInput}
                  onChange={(e) => { setNewCategoryInput(e.target.value); setShowNewCatDropdown(true); }}
                  onFocus={() => setShowNewCatDropdown(true)}
                  onBlur={() => setTimeout(() => setShowNewCatDropdown(false), 200)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addCategory(newCategoryInput, newCategories, setNewCategories, setNewCategoryInput); setShowNewCatDropdown(false); }
                  }}
                  placeholder="Type or select..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                />
                {showNewCatDropdown && (
                  <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {categories.filter(c => !newCategories.includes(c) && c.toLowerCase().includes(newCategoryInput.toLowerCase())).map((c) => (
                      <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { addCategory(c, newCategories, setNewCategories, setNewCategoryInput); setShowNewCatDropdown(false); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-indigo-50 text-gray-700">
                        {c}
                      </button>
                    ))}
                    {newCategoryInput.trim() && !categories.includes(newCategoryInput.trim()) && (
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { addCategory(newCategoryInput, newCategories, setNewCategories, setNewCategoryInput); setShowNewCatDropdown(false); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-green-50 text-green-700 border-t border-gray-100">
                        + Add &quot;{newCategoryInput.trim()}&quot;
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Description
              </label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Short description..."
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
              {adding ? "Adding..." : "Add Brand"}
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
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
      {error && !showAdd && (
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
            placeholder="Search brands..."
            className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
          />
        </div>
      </div>

      {/* Brands Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading brands...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {search ? `No brands match "${search}"` : "No brands yet. Add your first brand!"}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Brand</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Category</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Description</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedBrands.map((brand) =>
                editingId === brand.id ? (
                  <tr
                    key={brand.id}
                    className="border-b border-gray-100 last:border-0 bg-indigo-50/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <label className="relative cursor-pointer group">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 group-hover:ring-2 group-hover:ring-indigo-300 transition">
                            {editLogoPreview ? (
                              <img src={editLogoPreview} alt={editName} className="h-6 w-6 object-contain" />
                            ) : (
                              <span className="text-sm font-bold text-gray-400">{brand.name[0]}</span>
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
                            onChange={(e) => handleLogoSelect(e.target.files?.[0] || null, setEditLogo, setEditLogoPreview)}
                          />
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {editCategories.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {editCategories.map((cat) => (
                            <span key={cat} className="inline-flex items-center gap-0.5 rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-xs font-medium text-indigo-700">
                              {cat}
                              <button type="button" onClick={() => removeCategory(cat, editCategories, setEditCategories)} className="text-indigo-400 hover:text-indigo-600">
                                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="relative">
                        <input
                          type="text"
                          value={editCategoryInput}
                          onChange={(e) => { setEditCategoryInput(e.target.value); setShowEditCatDropdown(true); }}
                          onFocus={() => setShowEditCatDropdown(true)}
                          onBlur={() => setTimeout(() => setShowEditCatDropdown(false), 200)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); addCategory(editCategoryInput, editCategories, setEditCategories, setEditCategoryInput); setShowEditCatDropdown(false); }
                          }}
                          placeholder="Add category..."
                          className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                        />
                        {showEditCatDropdown && (
                          <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                            {categories.filter(c => !editCategories.includes(c) && c.toLowerCase().includes(editCategoryInput.toLowerCase())).map((c) => (
                              <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { addCategory(c, editCategories, setEditCategories, setEditCategoryInput); setShowEditCatDropdown(false); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-indigo-50 text-gray-700">
                                {c}
                              </button>
                            ))}
                            {editCategoryInput.trim() && !categories.includes(editCategoryInput.trim()) && (
                              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { addCategory(editCategoryInput, editCategories, setEditCategories, setEditCategoryInput); setShowEditCatDropdown(false); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-green-50 text-green-700 border-t border-gray-100">
                                + Add &quot;{editCategoryInput.trim()}&quot;
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Description"
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={handleSaveEdit}
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
                    key={brand.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                          {brand.logo_url ? (
                            <img src={brand.logo_url} alt={brand.name} className="h-6 w-6 object-contain" />
                          ) : (
                            <span className="text-sm font-bold text-gray-400">{brand.name[0]}</span>
                          )}
                        </div>
                        <span className="font-medium text-gray-900">{brand.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {brand.category ? (
                        <div className="flex flex-wrap gap-1">
                          {brand.category.split(",").map(c => c.trim()).filter(Boolean).map((cat) => (
                            <span key={cat} className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{cat}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                      {brand.description || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => startEdit(brand)}
                          className="text-indigo-600 hover:text-indigo-800 text-xs font-medium transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(brand.id, brand.name)}
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
        itemsPerPage={BRANDS_PER_PAGE}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
