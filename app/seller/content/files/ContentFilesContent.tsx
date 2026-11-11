"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "@/src/lib/supabase/client";
import Pagination, { usePagination } from "@/src/components/Pagination";

type SellerFile = {
  id: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  content_type: string;
  created_at: string;
  public_url: string;
};

export default function ContentFilesContent() {
  const [files, setFiles] = useState<SellerFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from("seller_files")
      .select("*")
      .eq("seller_id", sid)
      .order("created_at", { ascending: false });

    if (data) {
      const mapped: SellerFile[] = data.map((f: any) => {
        const { data: urlData } = supabase.storage
          .from("store-assets")
          .getPublicUrl(f.storage_path);
        return {
          ...f,
          public_url: urlData.publicUrl,
        };
      });
      setFiles(mapped);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_uid", userData.user.id)
        .maybeSingle();
      if (!profile) { setLoading(false); return; }

      const { data: seller } = await supabase
        .from("sellers")
        .select("id")
        .eq("profile_id", profile.id)
        .maybeSingle();
      if (!seller) { setLoading(false); return; }

      setSellerId(seller.id);
      await loadFiles(seller.id);
      setLoading(false);
    })();
  }, [loadFiles]);

  const uploadFiles = async (fileList: FileList) => {
    if (!sellerId || fileList.length === 0) return;
    setUploading(true);

    for (const file of Array.from(fileList)) {
      const ext = file.name.split(".").pop();
      const path = `sellers/${sellerId}/files/${Date.now()}-${file.name}`;

      const { error: uploadErr } = await supabase.storage
        .from("store-assets")
        .upload(path, file, { upsert: true });

      if (uploadErr) {
        console.error("Upload failed:", uploadErr.message);
        continue;
      }

      await supabase.from("seller_files").insert({
        seller_id: sellerId,
        file_name: file.name,
        storage_path: path,
        file_size: file.size,
        content_type: file.type || "application/octet-stream",
      });
    }

    await loadFiles(sellerId);
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const handleDelete = async (file: SellerFile) => {
    if (!confirm(`Delete "${file.file_name}"?`)) return;
    await supabase.storage.from("store-assets").remove([file.storage_path]);
    await supabase.from("seller_files").delete().eq("id", file.id);
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
  };

  const handleCopyUrl = (file: SellerFile) => {
    navigator.clipboard.writeText(file.public_url);
    setCopiedId(file.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const ITEMS_PER_PAGE = 8;
  const { currentPage, setCurrentPage, paginatedItems: paginatedFiles } = usePagination(files, ITEMS_PER_PAGE);

  const isImage = (type: string) => type.startsWith("image/");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Files</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload and manage files for your store.
        </p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
          dragOver
            ? "border-indigo-300 bg-indigo-50"
            : "border-gray-200 bg-gray-50 hover:border-gray-300"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) uploadFiles(e.target.files);
          }}
        />
        <svg
          className="mx-auto mb-3 h-10 w-10 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        {uploading ? (
          <p className="text-sm text-indigo-500 font-medium">Uploading...</p>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-700">
              Drag & drop files here, or click to browse
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Images, documents, videos, and more
            </p>
          </>
        )}
      </div>

      {/* Files grid */}
      {files.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <p className="text-sm text-gray-500">
            No files uploaded yet. Use the upload zone above to add files.
          </p>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {paginatedFiles.map((file) => (
            <div
              key={file.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden group"
            >
              <div className="h-32 bg-gray-50 flex items-center justify-center overflow-hidden">
                {isImage(file.content_type) ? (
                  <img
                    src={file.public_url}
                    alt={file.file_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <svg
                    className="h-10 w-10 text-gray-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                )}
              </div>
              <div className="p-3">
                <p className="text-xs font-medium text-gray-900 truncate">
                  {file.file_name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatSize(file.file_size)} &middot; {formatDate(file.created_at)}
                </p>
                <div className="mt-2 flex gap-1">
                  <button
                    onClick={() => handleCopyUrl(file)}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {copiedId === file.id ? "Copied!" : "Copy URL"}
                  </button>
                  <button
                    onClick={() => handleDelete(file)}
                    className="rounded-lg bg-red-50 border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <Pagination currentPage={currentPage} totalItems={files.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} itemLabel="files" />
        </>
      )}
    </div>
  );
}
