"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import Navbar from "@/src/components/Navbar";
import Footer from "@/src/components/Footer";
import ProductCard from "@/src/components/ProductCard";
import Spinner from "@/src/components/Spinner";
import { supabase } from "@/src/lib/supabase/client";
import {
  attachCategoryNames,
  fetchCatalogCategories,
  fetchProductsByIds,
  type ProductCardData,
} from "@/src/lib/catalog";

type CollectionInfo = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
};

export default function CollectionDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [collection, setCollection] = useState<CollectionInfo | null>(null);
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      // Fetch collection info
      const { data: col, error: colError } = await supabase
        .from("collections")
        .select("id, title, description, image_url, is_active")
        .eq("id", id)
        .eq("is_active", true)
        .maybeSingle();

      if (colError) throw colError;
      if (!col) {
        setNotFound(true);
        return;
      }

      setCollection(col);

      // Fetch product IDs in this collection
      const { data: cpData, error: cpError } = await supabase
        .from("collection_products")
        .select("product_id")
        .eq("collection_id", id)
        .order("position", { ascending: true });

      if (cpError) throw cpError;

      const productIdsList = (cpData || []).map((cp) => cp.product_id);
      const productIdsSet = new Set(productIdsList);

      if (productIdsSet.size === 0) {
        setProducts([]);
        return;
      }

      // Fetch only the products in this collection (not the entire catalog)
      const [fetched, categories] = await Promise.all([
        fetchProductsByIds(productIdsList),
        fetchCatalogCategories().catch(() => []),
      ]);
      const collectionProducts = attachCategoryNames(fetched, categories);

      // Sort by the collection order
      const idOrder = new Map(productIdsList.map((pid, i) => [pid, i]));
      collectionProducts.sort((a, b) => (idOrder.get(a.id) ?? 999) - (idOrder.get(b.id) ?? 999));

      setProducts(collectionProducts);
    } catch (err) {
      console.error("Failed to load collection:", err);
      setError(err instanceof Error ? err.message : "Failed to load collection. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex min-h-screen flex-col bg-[#faf9f6] text-slate-950">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="mb-6 text-sm text-slate-500">
            <Link href="/" className="hover:text-teal-800">Home</Link>
            <span className="mx-2">/</span>
            <Link href="/collections" className="hover:text-teal-800">Collections</Link>
            <span className="mx-2">/</span>
            <span className="text-slate-900">{collection?.title || "..."}</span>
          </nav>

          {loading ? (
            <div className="animate-pulse">
              <div className="mb-8 space-y-3">
                <div className="h-9 w-1/3 rounded bg-slate-200" />
                <div className="h-5 w-2/3 rounded bg-slate-100" />
                <div className="h-4 w-24 rounded bg-slate-100" />
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {Array.from({ length: 10 }).map((_, i) => (
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
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-16 text-center">
              <h2 className="text-xl font-semibold text-red-800">Something went wrong</h2>
              <p className="mt-2 text-sm text-red-600">{error}</p>
              <button
                onClick={() => load()}
                className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                Try again
              </button>
            </div>
          ) : notFound ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
              <h2 className="text-xl font-semibold">Collection not found</h2>
              <p className="mt-2 text-sm text-slate-600">
                This collection may have been removed or is no longer available.
              </p>
              <Link
                href="/collections"
                className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                Browse collections
              </Link>
            </div>
          ) : (
            <>
              {/* Collection header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  {collection?.title}
                </h1>
                {collection?.description && (
                  <p className="mt-3 max-w-2xl text-slate-600">{collection.description}</p>
                )}
                <p className="mt-2 text-sm text-slate-500">
                  {products.length} {products.length === 1 ? "product" : "products"}
                </p>
              </div>

              {products.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
                  <h3 className="text-lg font-semibold">No products in this collection yet</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    The seller hasn&apos;t added products to this collection yet.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
