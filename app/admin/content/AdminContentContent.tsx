"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SellerPage = {
  id: string;
  seller_id: string;
  title: string;
  slug: string;
  status: string;
  created_at: string;
  seller_name?: string;
};

type SellerFile = {
  id: string;
  seller_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  seller_name?: string;
};

type ContentTab = "pages" | "files";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AdminContentContent() {
  const [activeTab, setActiveTab] = useState<ContentTab>("pages");
  const [pages, setPages] = useState<SellerPage[]>([]);
  const [files, setFiles] = useState<SellerFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadContent = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // Load seller pages
      const { data: pagesData, error: pagesError } = await supabase
        .from("seller_pages")
        .select("id, seller_id, title, slug, status, created_at")
        .order("created_at", { ascending: false });

      if (pagesError) {
        setErrorMessage(pagesError.message);
        setLoading(false);
        return;
      }

      // Load seller files
      const { data: filesData, error: filesError } = await supabase
        .from("seller_files")
        .select("id, seller_id, file_name, file_url, file_type, file_size, created_at")
        .order("created_at", { ascending: false });

      if (filesError) {
        setErrorMessage(filesError.message);
        setLoading(false);
        return;
      }

      // Collect unique seller IDs
      const sellerIds = new Set<string>();
      (pagesData || []).forEach((p) => sellerIds.add(p.seller_id));
      (filesData || []).forEach((f) => sellerIds.add(f.seller_id));

      // Fetch seller names
      const sellerMap: Record<string, string> = {};
      if (sellerIds.size > 0) {
        const { data: sellers } = await supabase
          .from("sellers")
          .select("id, business_name")
          .in("id", Array.from(sellerIds));

        (sellers || []).forEach((s) => {
          sellerMap[s.id] = s.business_name;
        });
      }

      setPages(
        (pagesData || []).map((p) => ({
          ...p,
          seller_name: sellerMap[p.seller_id] || "Unknown Seller",
        }))
      );

      setFiles(
        (filesData || []).map((f) => ({
          ...f,
          seller_name: sellerMap[f.seller_id] || "Unknown Seller",
        }))
      );
    } catch {
      setErrorMessage("Failed to load content.");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "--";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "published":
        return "bg-emerald-100 text-emerald-800";
      case "draft":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Platform Content Management
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage seller pages and uploaded files across the platform
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        <button
          onClick={() => setActiveTab("pages")}
          className={`rounded-md px-4 py-2 text-xs font-semibold transition ${
            activeTab === "pages"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Seller Pages ({pages.length})
        </button>
        <button
          onClick={() => setActiveTab("files")}
          className={`rounded-md px-4 py-2 text-xs font-semibold transition ${
            activeTab === "files"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Files ({files.length})
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Pages Table */}
          {activeTab === "pages" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80">
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Title
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Seller
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Slug
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pages.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-12 text-center text-gray-500"
                        >
                          No seller pages found.
                        </td>
                      </tr>
                    ) : (
                      pages.map((page) => (
                        <tr
                          key={page.id}
                          className="hover:bg-gray-50/60 transition"
                        >
                          <td className="px-6 py-4 font-medium text-gray-900">
                            {page.title}
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {page.seller_name}
                          </td>
                          <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                            /{page.slug}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusBadge(
                                page.status
                              )}`}
                            >
                              {page.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {new Date(page.created_at).toLocaleDateString(
                              "en-IN",
                              { day: "numeric", month: "short", year: "numeric" }
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

          {/* Files Table */}
          {activeTab === "files" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80">
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        File Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Seller
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Type
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Uploaded
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {files.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-12 text-center text-gray-500"
                        >
                          No files uploaded yet.
                        </td>
                      </tr>
                    ) : (
                      files.map((file) => (
                        <tr
                          key={file.id}
                          className="hover:bg-gray-50/60 transition"
                        >
                          <td className="px-6 py-4">
                            <a
                              href={file.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                            >
                              {file.file_name}
                            </a>
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {file.seller_name}
                          </td>
                          <td className="px-6 py-4 text-gray-500">
                            {file.file_type || "--"}
                          </td>
                          <td className="px-6 py-4 text-right text-gray-500">
                            {formatFileSize(file.file_size)}
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {new Date(file.created_at).toLocaleDateString(
                              "en-IN",
                              { day: "numeric", month: "short", year: "numeric" }
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
        </>
      )}
    </div>
  );
}
