"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Navbar from "@/src/components/Navbar";
import Footer from "@/src/components/Footer";
import Spinner from "@/src/components/Spinner";
import { fetchBrands, type Brand } from "@/src/lib/brands";

export default function BrandsContent() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchBrands()
      .then(setBrands)
      .finally(() => setLoading(false));
  }, []);

  const filteredBrands = useMemo(
    () =>
      brands.filter(
        (b) =>
          !search.trim() ||
          b.name.toLowerCase().includes(search.toLowerCase()) ||
          (b.category || "").split(",").some(c => c.trim().toLowerCase().includes(search.toLowerCase()))
      ),
    [brands, search]
  );

  const allCategories = useMemo(() => {
    // Extract all unique categories (brands can have comma-separated multiple categories)
    const cats = Array.from(
      new Set(
        filteredBrands.flatMap((b) =>
          (b.category || "").split(",").map(c => c.trim()).filter(Boolean)
        )
      )
    ).sort();
    // A brand with multiple categories appears under each one
    return cats.map((cat) => ({
      name: cat,
      brands: filteredBrands.filter((b) =>
        (b.category || "").split(",").map(c => c.trim()).includes(cat)
      ),
    }));
  }, [filteredBrands]);

  return (
    <div className="min-h-screen bg-[#f7f8f6]">
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Shop by Brand
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Discover products from the world&apos;s top brands
          </p>
          <div className="mt-4">
            <input
              type="text"
              placeholder="Search brands..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
            />
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-10">
            {Array.from({ length: 2 }).map((_, gi) => (
              <div key={gi}>
                <div className="mb-4 h-6 w-32 rounded bg-slate-200" />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="h-16 w-16 rounded-xl bg-slate-200" />
                      <div className="h-4 w-20 rounded bg-slate-200" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Brand groups by category */}
            {filteredBrands.length === 0 && search.trim() && (
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
                <h3 className="text-lg font-semibold text-slate-900">No brands found</h3>
                <p className="mt-2 text-sm text-slate-500">
                  No brands match &ldquo;{search}&rdquo;. Try a different search term.
                </p>
              </div>
            )}
            {allCategories.map((group) => (
                <section key={group.name} className="mb-10">
                  <h2 className="mb-4 text-lg font-semibold text-slate-800">
                    {group.name}
                  </h2>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {group.brands.map((brand) => (
                      <Link
                        key={brand.slug}
                        href={`/brands/${brand.slug}`}
                        className="group flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-md"
                      >
                        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-slate-50 p-2">
                          {brand.logo_url ? (
                            <img
                              src={brand.logo_url}
                              alt={brand.name}
                              className="h-full w-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                                (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-2xl font-bold text-slate-400">${brand.name[0]}</span>`;
                              }}
                            />
                          ) : (
                            <span className="text-2xl font-bold text-slate-400">
                              {brand.name[0]}
                            </span>
                          )}
                        </div>
                        <div className="text-center">
                          <span className="block text-sm font-semibold text-slate-900 group-hover:text-teal-800">
                            {brand.name}
                          </span>
                          {brand.description && (
                            <span className="mt-1 block text-xs text-slate-500 line-clamp-2">
                              {brand.description}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
            ))}
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
