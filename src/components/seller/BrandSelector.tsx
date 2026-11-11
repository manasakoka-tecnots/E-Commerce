"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBrands, createBrand, type Brand } from "@/src/lib/brands";

interface BrandSelectorProps {
  value: string;
  onChange: (brand: string) => void;
}

export default function BrandSelector({ value, onChange }: BrandSelectorProps) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [search, setSearch] = useState(value);
  const [open, setOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandCategory, setNewBrandCategory] = useState("Other");
  const [adding, setAdding] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchBrands().then(setBrands);
  }, []);

  // Sync external value changes
  useEffect(() => {
    setSearch(value);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowAddForm(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = brands.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  const exactMatch = brands.some(
    (b) => b.name.toLowerCase() === search.toLowerCase()
  );

  const handleSelect = useCallback(
    (brandName: string) => {
      setSearch(brandName);
      onChange(brandName);
      setOpen(false);
    },
    [onChange]
  );

  const handleAddBrand = async () => {
    if (!newBrandName.trim()) return;
    setAdding(true);
    const slug = newBrandName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const created = await createBrand({
      name: newBrandName.trim(),
      slug,
      category: newBrandCategory,
    });

    if (created) {
      setBrands((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      handleSelect(created.name);
    }
    setAdding(false);
    setShowAddForm(false);
    setNewBrandName("");
  };

  const categories = Array.from(new Set(brands.map((b) => b.category).filter(Boolean)));
  if (!categories.includes("Other")) categories.push("Other");

  return (
    <div ref={ref} className="relative">
      <label className="text-sm font-medium text-gray-700 block mb-1">
        Brand
      </label>
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search or type a brand..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none pr-8"
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
          </svg>
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {filtered.length > 0 ? (
            filtered.map((brand) => (
              <button
                key={brand.slug}
                type="button"
                onClick={() => handleSelect(brand.name)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-gray-50 transition ${
                  brand.name === value ? "bg-indigo-50 text-indigo-700" : "text-gray-700"
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                  {brand.logo_url ? (
                    <img
                      src={brand.logo_url}
                      alt={brand.name}
                      className="h-6 w-6 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-xs font-bold text-gray-400">${brand.name[0]}</span>`;
                      }}
                    />
                  ) : (
                    <span className="text-xs font-bold text-gray-400">
                      {brand.name[0]}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{brand.name}</div>
                  {brand.category && (
                    <div className="text-xs text-gray-400">{brand.category}</div>
                  )}
                </div>
                {brand.name === value && (
                  <svg className="h-4 w-4 text-indigo-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-sm text-gray-500">
              No brands match &quot;{search}&quot;
            </div>
          )}

          {/* Add new brand option */}
          {search.trim() && !exactMatch && !showAddForm && (
            <button
              type="button"
              onClick={() => {
                setNewBrandName(search.trim());
                setShowAddForm(true);
              }}
              className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2.5 text-sm text-indigo-600 hover:bg-indigo-50 transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add &quot;{search.trim()}&quot; as a new brand
            </button>
          )}

          {/* Add brand form */}
          {showAddForm && (
            <div className="border-t border-gray-100 p-3 space-y-3">
              <div className="text-sm font-medium text-gray-700">Add new brand</div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Brand name</label>
                <input
                  type="text"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Category</label>
                <select
                  value={newBrandCategory}
                  onChange={(e) => setNewBrandCategory(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-400"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddBrand}
                  disabled={adding || !newBrandName.trim()}
                  className="flex-1 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {adding ? "Adding..." : "Add brand"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
