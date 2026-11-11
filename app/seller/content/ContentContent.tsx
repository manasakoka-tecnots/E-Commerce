"use client";

import { useCallback, useEffect, useState, useRef } from "react";

import { supabase } from "@/src/lib/supabase/client";
import Spinner from "@/src/components/Spinner";

type SellerFile = {
  id: string;
  seller_id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  created_at: string;
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isImage = (type: string) => type.startsWith("image/");

const fileIcon = (type: string) => {
  if (type.includes("pdf")) return "PDF";
  if (type.includes("video")) return "VID";
  if (type.includes("audio")) return "AUD";
  if (type.includes("spreadsheet") || type.includes("csv")) return "XLS";
  if (type.includes("document") || type.includes("word")) return "DOC";
  return "FILE";
};

export default function ContentContent() {
  const [files, setFiles] = useState<SellerFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const getSellerId = useCallback(async () => {
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
  }, []);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    const sellerId = await getSellerId();
    if (!sellerId) {
      setLoading(false);
      return;
    }

    const { data, error: fetchErr } = await supabase
      .from("seller_files")
      .select("*")
      .eq("seller_id", sellerId)
      .order("created_at", { ascending: false });

    if (fetchErr) setError(fetchErr.message);
    else setFiles(data ?? []);
    setLoading(false);
  }, [getSellerId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError(null);
    setSuccess(null);

    const sellerId = await getSellerId();
    if (!sellerId) {
      setError("Seller profile not found");
      setUploading(false);
      return;
    }

    const ext = file.name.split(".").pop();
    const path = `sellers/${sellerId}/content/${Date.now()}-${file.name}`;

    const { error: upErr } = await supabase.storage
      .from("seller-content")
      .upload(path, file);

    if (upErr) {
      setError(`Upload failed: ${upErr.message}`);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("seller-content").getPublicUrl(path);

    const { error: insertErr } = await supabase.from("seller_files").insert({
      seller_id: sellerId,
      name: file.name,
      type: file.type,
      size: file.size,
      url: urlData.publicUrl,
    });

    if (insertErr) setError(insertErr.message);
    else {
      setSuccess("File uploaded!");
      loadFiles();
    }
    setUploading(false);
  };

  const handleDelete = async (f: SellerFile) => {
    if (!confirm(`Delete "${f.name}"?`)) return;
    const { error: delErr } = await supabase.from("seller_files").delete().eq("id", f.id);
    if (delErr) setError(delErr.message);
    else loadFiles();
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setSuccess("URL copied to clipboard!");
    setTimeout(() => setSuccess(null), 2000);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f) uploadFile(f);
  };

  return (
    
      <div className="min-h-screen bg-gray-50 p-6 md:p-10">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Content Files</h1>
              <p className="mt-1 text-sm text-gray-500">
                Upload and manage images, documents, and other files.
              </p>
            </div>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload File"}
            </button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f);
              }}
            />
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

          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed p-10 text-center transition ${
              dragActive
                ? "border-indigo-300 bg-indigo-50"
                : "border-gray-300 bg-white"
            }`}
          >
            <svg
              className="mx-auto mb-3 h-10 w-10 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            <p className="text-sm text-gray-600">
              Drag and drop a file here, or{" "}
              <button
                onClick={() => inputRef.current?.click()}
                className="font-medium text-indigo-500 hover:text-indigo-400"
              >
                browse
              </button>
            </p>
            <p className="mt-1 text-xs text-gray-400">
              PNG, JPG, PDF, DOC, XLS up to 10MB
            </p>
          </div>

          {/* Files Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner />
            </div>
          ) : files.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm">
              <svg
                className="mx-auto mb-4 h-12 w-12 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                />
              </svg>
              <h3 className="text-sm font-medium text-gray-900">No files uploaded</h3>
              <p className="mt-1 text-sm text-gray-500">
                Upload images and documents to use in your store.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {files.map((f) => (
                <div
                  key={f.id}
                  className="group rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
                >
                  {/* Preview */}
                  <div className="flex h-40 items-center justify-center bg-gray-50">
                    {isImage(f.type) ? (
                      <img
                        src={f.url}
                        alt={f.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-bold text-gray-300">
                        {fileIcon(f.type)}
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-3">
                    <p className="truncate text-sm font-medium text-gray-900">{f.name}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                      <span>{formatSize(f.size)}</span>
                      <span>-</span>
                      <span>{new Date(f.created_at).toLocaleDateString("en-IN")}</span>
                    </div>

                    {/* Actions */}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleCopyUrl(f.url)}
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium hover:bg-gray-50"
                      >
                        Copy URL
                      </button>
                      <button
                        onClick={() => handleDelete(f)}
                        className="rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    
  );
}
