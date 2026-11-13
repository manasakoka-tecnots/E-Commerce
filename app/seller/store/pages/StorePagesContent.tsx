"use client";

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/src/lib/supabase/client";
import { useStaff } from "@/src/context/StaffContext";
import Spinner from "@/src/components/Spinner";
import Pagination, { usePagination } from "@/src/components/Pagination";

type SellerPage = {
  id: string;
  seller_id: string;
  title: string;
  slug: string;
  body: string;
  is_published: boolean;
  updated_at: string;
  created_at: string;
};

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export default function StorePagesContent() {
  const { sellerId: staffSellerId } = useStaff();
  const ITEMS_PER_PAGE = 8;
  const [pages, setPages] = useState<SellerPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [body, setBody] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  const getSellerId = useCallback(async () => {
    if (staffSellerId) return staffSellerId;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_uid", userData.user.id)
      .maybeSingle();
    if (!profile) return null;
    const { data: seller } = await supabase
      .from("sellers")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("status", "approved")
      .maybeSingle();
    return seller?.id ?? null;
  }, [staffSellerId]);

  const loadPages = useCallback(async () => {
    setLoading(true);
    const sellerId = await getSellerId();
    if (!sellerId) {
      setLoading(false);
      return;
    }

    const { data, error: fetchErr } = await supabase
      .from("seller_pages")
      .select("*")
      .eq("seller_id", sellerId)
      .order("updated_at", { ascending: false });

    if (fetchErr) setError(fetchErr.message);
    else setPages(data ?? []);
    setLoading(false);
  }, [getSellerId]);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  const resetForm = () => {
    setTitle("");
    setSlug("");
    setBody("");
    setIsPublished(false);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const sellerId = await getSellerId();
    if (!sellerId) {
      setError("Seller profile not found");
      setSubmitting(false);
      return;
    }

    if (editingId) {
      const { error: updErr } = await supabase
        .from("seller_pages")
        .update({ title, slug, body, is_published: isPublished, updated_at: new Date().toISOString() })
        .eq("id", editingId);
      if (updErr) setError(updErr.message);
      else {
        setSuccess("Page updated!");
        resetForm();
        loadPages();
      }
    } else {
      const { error: insertErr } = await supabase.from("seller_pages").insert({
        seller_id: sellerId,
        title,
        slug,
        body,
        is_published: isPublished,
      });
      if (insertErr) setError(insertErr.message);
      else {
        setSuccess("Page created!");
        resetForm();
        loadPages();
      }
    }
    setSubmitting(false);
  };

  const handleEdit = (p: SellerPage) => {
    setEditingId(p.id);
    setTitle(p.title);
    setSlug(p.slug);
    setBody(p.body);
    setIsPublished(p.is_published);
    setShowForm(true);
  };

  const { currentPage, setCurrentPage, paginatedItems: paginatedPages } = usePagination(pages, ITEMS_PER_PAGE);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this page?")) return;
    const { error: delErr } = await supabase.from("seller_pages").delete().eq("id", id);
    if (delErr) setError(delErr.message);
    else loadPages();
  };

  return (
    
      <div className="min-h-screen bg-gray-50 p-6 md:p-10">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Store Pages</h1>
              <p className="mt-1 text-sm text-gray-500">
                Create custom pages for your storefront (About, FAQ, Policies, etc.).
              </p>
            </div>
            <button
              onClick={() => {
                if (showForm) resetForm();
                else setShowForm(true);
              }}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600"
            >
              {showForm ? "Cancel" : "Add Page"}
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {success}
            </div>
          )}

          {/* Form */}
          {showForm && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                {editingId ? "Edit Page" : "New Page"}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (!editingId) setSlug(slugify(e.target.value));
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    placeholder="About Us"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Slug</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">/pages/</span>
                    <input
                      type="text"
                      required
                      value={slug}
                      onChange={(e) => setSlug(slugify(e.target.value))}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                      placeholder="about-us"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Body</label>
                  <textarea
                    required
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={10}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    placeholder="Write your page content here..."
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={isPublished}
                      onChange={(e) => setIsPublished(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="h-5 w-9 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-indigo-500 peer-checked:after:translate-x-full"></div>
                  </label>
                  <span className="text-sm text-gray-700">Publish immediately</span>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingId ? "Update Page" : "Create Page"}
                </button>
              </form>
            </div>
          )}

          {/* Pages Table */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Spinner />
              </div>
            ) : pages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <svg className="mb-4 h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <h3 className="text-sm font-medium text-gray-900">No pages yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Create custom pages like About, FAQ, or Return Policy.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 font-medium text-gray-700">Title</th>
                      <th className="px-4 py-3 font-medium text-gray-700">Slug</th>
                      <th className="px-4 py-3 font-medium text-gray-700">Status</th>
                      <th className="px-4 py-3 font-medium text-gray-700">Last Modified</th>
                      <th className="px-4 py-3 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedPages.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{p.title}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">/pages/{p.slug}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              p.is_published
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {p.is_published ? "Published" : "Draft"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(p.updated_at).toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(p)}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium hover:bg-gray-50"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination currentPage={currentPage} totalItems={pages.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} itemLabel="pages" />
          </div>
        </div>
      </div>
    
  );
}
