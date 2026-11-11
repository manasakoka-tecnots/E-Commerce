"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Navbar from "@/src/components/Navbar";
import Footer from "@/src/components/Footer";
import ProductCard from "@/src/components/ProductCard";
import Spinner from "@/src/components/Spinner";
import {
  attachCategoryNames,
  fetchCatalogCategories,
  fetchProductsByBrand,
  patchLocalUploads,
  type ProductCardData,
} from "@/src/lib/catalog";
import { fetchBrandBySlug, fetchBrands, type Brand } from "@/src/lib/brands";

export default function BrandDetailContent() {
  const { slug } = useParams<{ slug: string }>();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [foundBrand, brands] = await Promise.all([
        fetchBrandBySlug(slug),
        fetchBrands(),
      ]);
      setBrand(foundBrand);
      setAllBrands(brands);

      if (foundBrand) {
        // Fetch only this brand's products (not the entire catalog)
        const [brandProducts, categories] = await Promise.all([
          fetchProductsByBrand(foundBrand.name),
          fetchCatalogCategories(),
        ]);
        let items = attachCategoryNames(brandProducts, categories);
        items = await patchLocalUploads(items);
        setProducts(items);
      }
    } catch (err) {
      console.error("Failed to load brand products:", err);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8f6]">
        <Navbar />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
          <div className="mb-6 h-4 w-48 rounded bg-slate-200" />
          <div className="mb-8 flex items-center gap-5 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="h-20 w-20 shrink-0 rounded-xl bg-slate-200" />
            <div className="space-y-2 flex-1">
              <div className="h-7 w-40 rounded bg-slate-200" />
              <div className="h-4 w-64 rounded bg-slate-100" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="aspect-square bg-slate-200" />
                <div className="p-3 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-slate-200" />
                  <div className="h-3 w-1/2 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="min-h-screen bg-[#f7f8f6]">
        <Navbar />
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-slate-900">Brand not found</h1>
          <p className="mt-2 text-slate-500">
            The brand you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link
            href="/brands"
            className="mt-6 inline-block rounded-full bg-slate-950 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-900"
          >
            View all brands
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8f6]">
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-slate-500">
          <Link href="/" className="hover:text-teal-800">
            Home
          </Link>{" "}
          /{" "}
          <Link href="/brands" className="hover:text-teal-800">
            Brands
          </Link>{" "}
          / <span className="text-slate-900">{brand.name}</span>
        </nav>

        {/* Brand header */}
        <div className="mb-8 flex items-center gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 p-3">
            {brand.logo_url ? (
              <img
                src={brand.logo_url}
                alt={brand.name}
                className="h-full w-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-3xl font-bold text-slate-400">${brand.name[0]}</span>`;
                }}
              />
            ) : (
              <span className="text-3xl font-bold text-slate-400">
                {brand.name[0]}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{brand.name}</h1>
            {brand.description && (
              <p className="mt-1 text-sm text-slate-500">{brand.description}</p>
            )}
            {brand.category && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {brand.category.split(",").map(c => c.trim()).filter(Boolean).map((cat) => (
                  <span key={cat} className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Products */}
        {products.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              No products yet
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Products from {brand.name} will appear here once sellers list them.
            </p>
            <Link
              href="/brands"
              className="mt-6 inline-block rounded-full bg-slate-950 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-900"
            >
              Explore other brands
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-500">
              {products.length} {products.length === 1 ? "product" : "products"} from {brand.name}
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}

        {/* Other brands */}
        <div className="mt-12">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">
            Other popular brands
          </h2>
          <div className="flex flex-wrap gap-3">
            {allBrands
              .filter((b) => b.slug !== brand.slug)
              .map((b) => (
                <Link
                  key={b.slug}
                  href={`/brands/${b.slug}`}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
                >
                  {b.name}
                </Link>
              ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
