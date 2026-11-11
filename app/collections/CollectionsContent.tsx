"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import Navbar from "@/src/components/Navbar";
import Footer from "@/src/components/Footer";
import Pagination, { usePagination } from "@/src/components/Pagination";
import Spinner from "@/src/components/Spinner";
import { supabase } from "@/src/lib/supabase/client";

type Collection = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  product_count: number;
  seller_name: string | null;
};

export default function CollectionsContent() {
  const COLLECTIONS_PER_PAGE = 8;
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const paginatedCollections = usePagination(collections, currentPage, COLLECTIONS_PER_PAGE);

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from("collections")
          .select("id, title, description, image_url, seller_id, is_active")
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Batch-fetch product counts and seller names in 2 queries instead of N+1
        const collectionIds = (data || []).map((c) => c.id);
        const sellerIds = [...new Set((data || []).map((c) => c.seller_id).filter(Boolean))] as string[];

        const [cpRes, sellerRes] = await Promise.all([
          supabase.from("collection_products").select("collection_id").in("collection_id", collectionIds),
          sellerIds.length > 0
            ? supabase.from("sellers").select("id, business_name").in("id", sellerIds)
            : Promise.resolve({ data: [] as { id: string; business_name: string }[] }),
        ]);

        // Count products per collection
        const countMap = new Map<string, number>();
        for (const row of cpRes.data || []) {
          countMap.set(row.collection_id, (countMap.get(row.collection_id) || 0) + 1);
        }

        // Map seller names
        const sellerMap = new Map<string, string>();
        for (const s of (sellerRes as { data: { id: string; business_name: string }[] | null }).data || []) {
          sellerMap.set(s.id, s.business_name);
        }

        const collectionsWithCounts: Collection[] = (data || []).map((col) => ({
          id: col.id,
          title: col.title,
          description: col.description,
          image_url: col.image_url,
          product_count: countMap.get(col.id) || 0,
          seller_name: col.seller_id ? sellerMap.get(col.seller_id) || null : null,
        }));

        setCollections(collectionsWithCounts);
      } catch (err) {
        console.error("Failed to load collections:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#faf9f6] text-slate-950">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <nav className="mb-4 text-sm text-slate-500">
              <Link href="/" className="hover:text-teal-800">Home</Link>
              <span className="mx-2">/</span>
              <span className="text-slate-900">Collections</span>
            </nav>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Collections</h1>
            <p className="mt-2 text-slate-600">
              Curated product collections from our sellers — browse themed groups and find what you need.
            </p>
          </div>

          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="aspect-[16/9] bg-slate-200" />
                  <div className="p-5 space-y-3">
                    <div className="h-5 w-3/4 rounded bg-slate-200" />
                    <div className="h-4 w-full rounded bg-slate-100" />
                    <div className="h-3 w-1/3 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : collections.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
              <svg className="mx-auto h-16 w-16 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" />
              </svg>
              <h3 className="mt-4 text-lg font-semibold">No collections yet</h3>
              <p className="mt-2 text-sm text-slate-600">
                Sellers haven&apos;t created any collections yet. Check back soon!
              </p>
              <Link
                href="/products"
                className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                Browse all products
              </Link>
            </div>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedCollections.map((collection) => (
                <Link
                  key={collection.id}
                  href={`/collections/${collection.id}`}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
                >
                  <div className="relative aspect-[16/9] bg-gradient-to-br from-[#e8eee7] to-[#d6e0d4]">
                    {collection.image_url ? (
                      <Image
                        src={collection.image_url}
                        alt={collection.title}
                        fill
                        unoptimized
                        className="object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <svg className="h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-semibold text-slate-900 group-hover:text-teal-800 transition">
                      {collection.title}
                    </h3>
                    {collection.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{collection.description}</p>
                    )}
                    <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                      <span>{collection.product_count} {collection.product_count === 1 ? "product" : "products"}</span>
                      {collection.seller_name && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span>by {collection.seller_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
              </div>
              <Pagination
                currentPage={currentPage}
                totalItems={collections.length}
                itemsPerPage={COLLECTIONS_PER_PAGE}
                onPageChange={setCurrentPage}
                itemLabel="collections"
              />
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
