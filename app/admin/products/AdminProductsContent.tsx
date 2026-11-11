"use client";

import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";
import Pagination, { usePagination } from "@/src/components/Pagination";

type SellerOption = { id: string; business_name: string };
type ProductListing = {
  id: string;
  seller_id: string;
  price: number;
  stock: number;
  status: string;
};
type ProductImage = { id: string; storage_path: string; alt_text: string | null };
type ProductRecord = {
  id: string;
  name: string;
  brand: string | null;
  description: string | null;
  status: "pending" | "approved" | "rejected";
  seller_listings: ProductListing[];
  product_images: ProductImage[];
};
type AdminData =
  | { error: string }
  | { authorized: false }
  | { authorized: true; sellers: SellerOption[]; products: ProductRecord[] };

type ProductForm = {
  name: string;
  brand: string;
  description: string;
  status: ProductRecord["status"];
  sellerId: string;
  price: string;
  stock: string;
};

const initialForm: ProductForm = {
  name: "",
  brand: "",
  description: "",
  status: "approved",
  sellerId: "",
  price: "",
  stock: "",
};

const PRODUCTS_PER_PAGE = 20;

export default function AdminProductsContent() {
  const [authorized, setAuthorized] = useState(false);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [sellers, setSellers] = useState<SellerOption[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [form, setForm] = useState<ProductForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadAdminData = async (): Promise<AdminData> => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return { error: userError?.message ?? "Please sign in to continue." };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("auth_uid", userData.user.id)
      .maybeSingle();
    if (profileError) return { error: profileError.message };
    if (profile?.role !== "admin") return { authorized: false };

    const [sellerResult, productResult] = await Promise.all([
      supabase
        .from("sellers")
        .select("id, business_name")
        .eq("status", "approved")
        .order("business_name"),
      supabase
        .from("products")
        .select("id, name, brand, description, status, seller_listings(id, seller_id, price, stock, status), product_images(id, storage_path, alt_text)")
        .order("created_at", { ascending: false }),
    ]);

    if (sellerResult.error || productResult.error) {
      return {
        error: sellerResult.error?.message ?? productResult.error?.message ?? "Unable to load product management data.",
      };
    }

    return {
      authorized: true,
      sellers: sellerResult.data,
      products: productResult.data as ProductRecord[],
    };
  };

  useEffect(() => {
    let cancelled = false;
    void loadAdminData().then((result) => {
      if (cancelled) return;
      setLoading(false);
      if ("error" in result) {
        setErrorMessage(result.error);
      } else if (!result.authorized) {
        setErrorMessage("This page is available to administrators only.");
      } else {
        setAuthorized(true);
        setSellers(result.sellers);
        setProducts(result.products);
        setForm((current) => ({
          ...current,
          sellerId: current.sellerId || result.sellers[0]?.id || "",
        }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshProducts = async () => {
    const result = await loadAdminData();
    if ("error" in result) {
      setErrorMessage(result.error);
    } else if (!result.authorized) {
      setErrorMessage("This page is available to administrators only.");
      setAuthorized(false);
    } else {
      setProducts(result.products);
      setSellers(result.sellers);
    }
  };

  const selectImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setErrorMessage(null);
    if (file && (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)) {
      setErrorMessage("Choose an image up to 5 MB.");
      event.target.value = "";
      setImageFile(null);
      return;
    }
    setImageFile(file);
  };

  const editProduct = (product: ProductRecord) => {
    const listing = product.seller_listings[0];
    setEditingId(product.id);
    setImageFile(null);
    setErrorMessage(null);
    setNotice(null);
    setForm({
      name: product.name,
      brand: product.brand ?? "",
      description: product.description ?? "",
      status: product.status,
      sellerId: listing?.seller_id ?? sellers[0]?.id ?? "",
      price: listing ? String(listing.price) : "",
      stock: listing ? String(listing.stock) : "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setEditingId(null);
    setImageFile(null);
    setForm({ ...initialForm, sellerId: sellers[0]?.id ?? "" });
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setNotice(null);

    if (!form.sellerId) {
      setErrorMessage("Approve at least one seller before publishing a product listing.");
      return;
    }

    const price = Number(form.price);
    const stock = Number(form.stock);
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
      setErrorMessage("Enter a non-negative price and whole-number stock quantity.");
      return;
    }

    setSaving(true);
    const productValues = {
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      description: form.description.trim() || null,
      status: form.status,
    };
    const productResult = editingId
      ? await supabase
          .from("products")
          .update(productValues)
          .eq("id", editingId)
          .select("id")
          .single()
      : await supabase
          .from("products")
          .insert(productValues)
          .select("id")
          .single();

    if (productResult.error) {
      setErrorMessage(productResult.error.message);
      setSaving(false);
      return;
    }

    const productId = productResult.data.id;
    const { error: listingError } = await supabase
      .from("seller_listings")
      .upsert(
        {
          seller_id: form.sellerId,
          product_id: productId,
          price,
          stock,
          status: form.status === "approved" ? "active" : "pending",
        },
        { onConflict: "seller_id,product_id" },
      );

    if (listingError) {
      setErrorMessage(`Product saved, but its seller listing could not be saved: ${listingError.message}`);
      setSaving(false);
      await refreshProducts();
      return;
    }

    if (imageFile) {
      const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${productId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(storagePath, imageFile, { contentType: imageFile.type, upsert: false });

      if (uploadError) {
        setErrorMessage(`Product saved, but the image could not be uploaded: ${uploadError.message}`);
        setSaving(false);
        await refreshProducts();
        return;
      }

      const { error: imageError } = await supabase.from("product_images").insert({
        product_id: productId,
        storage_path: storagePath,
        alt_text: form.name.trim(),
      });

      if (imageError) {
        const { error: cleanupError } = await supabase.storage
          .from("product-images")
          .remove([storagePath]);
        const cleanupMessage = cleanupError ? ` Image cleanup also failed: ${cleanupError.message}` : "";
        setErrorMessage(`Product saved, but its image record could not be saved: ${imageError.message}.${cleanupMessage}`);
        setSaving(false);
        await refreshProducts();
        return;
      }
    }

    setSaving(false);
    setNotice(editingId ? "Product updated." : "Product created.");
    resetForm();
    await refreshProducts();
  };

  const paginatedProducts = usePagination(products, currentPage, PRODUCTS_PER_PAGE);

  // Reset to page 1 when products list changes (e.g. after create/delete)
  useEffect(() => {
    setCurrentPage(1);
  }, [products.length]);

  const deleteProduct = async (product: ProductRecord) => {
    if (!window.confirm(`Delete "${product.name}" and its seller listings?`)) return;
    setErrorMessage(null);
    setNotice(null);
    setSaving(true);

    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    const paths = product.product_images.map((image) => image.storage_path);
    let storageCleanupError: string | null = null;
    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("product-images")
        .remove(paths);
      if (storageError) storageCleanupError = storageError.message;
    }

    if (editingId === product.id) resetForm();
    setSaving(false);
    setNotice(storageCleanupError
      ? "Product deleted, but its stored images could not be removed."
      : "Product deleted.");
    if (storageCleanupError) {
      setErrorMessage(`Stored image cleanup failed: ${storageCleanupError}`);
    }
    await refreshProducts();
  };

  return (
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manage Products</h1>
            <p className="text-sm text-gray-500 mt-1">Add, edit, and manage your marketplace catalog</p>
          </div>
        </div>

        {loading ? (
          <p>Loading product management…</p>
        ) : !authorized ? (
          <p role="alert" className="text-red-700">{errorMessage}</p>
        ) : (
          <>
            <form className="grid gap-4 rounded border p-5 md:grid-cols-2" onSubmit={saveProduct}>
              <h2 className="text-xl font-semibold md:col-span-2">
                {editingId ? "Edit product" : "New product"}
              </h2>
              <label className="grid gap-1">
                Product name
                <input className="rounded border p-2" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required minLength={2} maxLength={200} />
              </label>
              <label className="grid gap-1">
                Brand
                <input className="rounded border p-2" value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} maxLength={120} />
              </label>
              <label className="grid gap-1 md:col-span-2">
                Description
                <textarea className="rounded border p-2" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} maxLength={2000} />
              </label>
              <label className="grid gap-1">
                Product status
                <select className="rounded border p-2" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ProductForm["status"] })}>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
              <label className="grid gap-1">
                Approved seller
                <select className="rounded border p-2" value={form.sellerId} onChange={(event) => setForm({ ...form, sellerId: event.target.value })} required>
                  <option value="" disabled>Select a seller</option>
                  {sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.business_name}</option>)}
                </select>
              </label>
              <label className="grid gap-1">
                Price (INR)
                <input className="rounded border p-2" type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
              </label>
              <label className="grid gap-1">
                Stock
                <input className="rounded border p-2" type="number" min="0" step="1" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} required />
              </label>
              <label className="grid gap-1 md:col-span-2">
                Product image (optional, max 5 MB)
                <input className="rounded border p-2" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={selectImage} />
              </label>
              <div className="flex flex-wrap gap-3 md:col-span-2">
                <button className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50" type="submit" disabled={saving || sellers.length === 0}>
                  {saving ? "Saving…" : editingId ? "Save changes" : "Create product"}
                </button>
                {editingId && <button className="rounded border px-4 py-2" type="button" disabled={saving} onClick={resetForm}>Cancel edit</button>}
                {sellers.length === 0 && <p className="self-center text-sm text-amber-800">Approve a seller application before publishing product offers.</p>}
              </div>
            </form>

            {errorMessage && <p role="alert" className="text-red-700">{errorMessage}</p>}
            {notice && <p role="status" className="text-green-700">{notice}</p>}

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Catalog products</h2>
              {products.length === 0 ? <p>No products found.</p> : (
                <>
                <ul className="divide-y rounded border">
                  {paginatedProducts.map((product) => {
                    const listing = product.seller_listings[0];
                    const image = product.product_images[0];
                    const imageUrl = image
                      ? image.storage_path.startsWith("https://images.unsplash.com/")
                        ? image.storage_path
                        : supabase.storage.from("product-images").getPublicUrl(image.storage_path).data.publicUrl
                      : null;

                    return (
                      <li key={product.id} className="flex flex-wrap items-center gap-4 p-4">
                        {imageUrl ? (
                          <Image src={imageUrl} alt={image?.alt_text || product.name} width={80} height={64} unoptimized className="h-16 w-20 rounded object-cover" />
                        ) : (
                          <div className="flex h-16 w-20 items-center justify-center rounded bg-gray-100 p-2 text-center text-xs text-gray-500">No image</div>
                        )}
                        <div className="min-w-48 flex-1">
                          <h3 className="font-semibold">{product.name}</h3>
                          <p className="text-sm text-gray-600">
                            {product.brand || "No brand"} · {product.status}
                            {listing ? ` · ₹${Number(listing.price).toFixed(2)} · stock ${listing.stock}` : " · no seller offer"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button className="rounded border px-3 py-2" type="button" disabled={saving} onClick={() => editProduct(product)}>Edit</button>
                          <button className="rounded border border-red-300 px-3 py-2 text-red-700" type="button" disabled={saving} onClick={() => void deleteProduct(product)}>Delete</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <Pagination
                  currentPage={currentPage}
                  totalItems={products.length}
                  itemsPerPage={PRODUCTS_PER_PAGE}
                  onPageChange={setCurrentPage}
                  itemLabel="products"
                />
                </>
              )}
            </section>
          </>
        )}
      </main>
  );
}
