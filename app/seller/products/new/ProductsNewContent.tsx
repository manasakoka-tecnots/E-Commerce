"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/src/lib/supabase/client";
import BrandSelector from "@/src/components/seller/BrandSelector";
import { useStaff } from "@/src/context/StaffContext";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Category = { id: string; name: string };

type VariantOption = {
  name: string;
  values: string[];
};

type VariantRow = {
  combination: string;
  sku: string;
  barcode: string;
  price: string;
  stock: string;
  available: boolean;
};

type SellerLocation = {
  id: string;
  name: string;
  type: string;
  is_default: boolean;
};

type ImagePreview = {
  file: File;
  url: string;
  isMain: boolean;
};

type FormData = {
  /* Product information */
  title: string;
  description: string;
  brand: string;
  productType: string;
  tagsInput: string;
  tags: string[];
  /* Pricing */
  price: string;
  compareAtPrice: string;
  costPerItem: string;
  taxApplicable: boolean;
  /* Inventory */
  sku: string;
  barcode: string;
  trackQuantity: boolean;
  stock: string;
  continueSellingOutOfStock: boolean;
  lowStockThreshold: string;
  /* Shipping */
  isPhysical: boolean;
  weight: string;
  weightUnit: string;
  dimensionL: string;
  dimensionW: string;
  dimensionH: string;
  countryOfOrigin: string;
  hsCode: string;
  shippingFee: string;
  processingTime: string;
  deliveryDuration: string;
  shippingRestrictions: string;
  fulfillmentNotes: string;
  /* SEO */
  seoTitle: string;
  metaDescription: string;
  urlHandle: string;
  /* Status */
  status: string;
  /* Organization */
  categoryId: string;
  subcategory: string;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const initialForm: FormData = {
  title: "",
  description: "",
  brand: "",
  productType: "",
  tagsInput: "",
  tags: [],
  price: "",
  compareAtPrice: "",
  costPerItem: "",
  taxApplicable: true,
  sku: "",
  barcode: "",
  trackQuantity: true,
  stock: "",
  continueSellingOutOfStock: false,
  lowStockThreshold: "5",
  isPhysical: true,
  weight: "",
  weightUnit: "kg",
  dimensionL: "",
  dimensionW: "",
  dimensionH: "",
  countryOfOrigin: "India",
  hsCode: "",
  shippingFee: "",
  processingTime: "1-2 business days",
  deliveryDuration: "3-7 business days",
  shippingRestrictions: "",
  fulfillmentNotes: "",
  seoTitle: "",
  metaDescription: "",
  urlHandle: "",
  status: "draft",
  categoryId: "",
  subcategory: "",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ProductsNewContent() {
  const router = useRouter();
  const { sellerId: staffSellerId, isStaff, assignedLocationIds } = useStaff();

  /* Auth & seller state */
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  /* Categories */
  const [categories, setCategories] = useState<Category[]>([]);

  /* Form */
  const [form, setForm] = useState<FormData>(initialForm);

  /* Images */
  const [images, setImages] = useState<ImagePreview[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Locations & per-location stock */
  const [locations, setLocations] = useState<SellerLocation[]>([]);
  const [locationStock, setLocationStock] = useState<Record<string, number>>({});

  /* Variants */
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([]);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);

  /* Submit state */
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  /* ---- field helpers ---- */
  const set = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    []
  );

  const setAndSyncSeo = useCallback(
    (title: string) => {
      setForm((prev) => {
        const updated: Partial<FormData> = { title };
        if (!prev.seoTitle || prev.seoTitle === prev.title) {
          updated.seoTitle = title;
        }
        if (!prev.urlHandle || prev.urlHandle === slugify(prev.title)) {
          updated.urlHandle = slugify(title);
        }
        return { ...prev, ...updated };
      });
    },
    []
  );

  const setAndSyncMetaDesc = useCallback(
    (desc: string) => {
      setForm((prev) => {
        const updated: Partial<FormData> = { description: desc };
        if (!prev.metaDescription || prev.metaDescription === prev.description) {
          updated.metaDescription = desc.slice(0, 160);
        }
        return { ...prev, ...updated };
      });
    },
    []
  );

  /* ---- auth check ---- */
  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setAuthError("Please sign in to create products.");
        setAuthLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("auth_uid", userData.user.id)
        .maybeSingle();

      if (!profile || (profile.role !== "seller" && profile.role !== "admin" && !staffSellerId)) {
        setAuthError("You do not have seller permissions.");
        setAuthLoading(false);
        return;
      }

      let resolvedSellerId = staffSellerId;
      if (!resolvedSellerId) {
        const { data: seller } = await supabase
          .from("sellers")
          .select("id, status")
          .eq("profile_id", profile.id)
          .maybeSingle();

        if (!seller || seller.status !== "approved") {
          setAuthError("Your seller account is not yet approved.");
          setAuthLoading(false);
          return;
        }
        resolvedSellerId = seller.id;
      }

      setSellerId(resolvedSellerId);

      /* Load seller locations */
      const { data: locs } = await supabase
        .from("seller_locations")
        .select("id, name, type, is_default")
        .eq("seller_id", resolvedSellerId)
        .eq("is_active", true)
        .order("fulfillment_priority", { ascending: true });
      if (locs && locs.length > 0) {
        // Staff members only see their assigned locations
        const filteredLocs = isStaff && assignedLocationIds.length > 0
          ? locs.filter((loc: any) => assignedLocationIds.includes(loc.id))
          : locs;
        setLocations(filteredLocs);
        const stockMap: Record<string, number> = {};
        filteredLocs.forEach((loc: any) => { stockMap[loc.id] = 0; });
        setLocationStock(stockMap);
      }

      const { data: cats } = await supabase
        .from("categories")
        .select("id, name")
        .order("name");
      if (cats && cats.length > 0) {
        setCategories(cats);
        setForm((prev) => (prev.categoryId ? prev : { ...prev, categoryId: cats[0].id }));
      }

      setAuthLoading(false);
    })();
  }, [staffSellerId]);

  /* ---- tag handling ---- */
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const raw = form.tagsInput.replace(/,/g, "").trim();
      if (raw && !form.tags.includes(raw)) {
        setForm((prev) => ({
          ...prev,
          tags: [...prev.tags, raw],
          tagsInput: "",
        }));
      }
    }
  };

  const removeTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  /* ---- image handling ---- */
  const handleImageFiles = (files: FileList | null) => {
    if (!files) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    const maxSize = 5 * 1024 * 1024;
    const remaining = 10 - images.length;
    const newImages: ImagePreview[] = [];

    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const f = files[i];
      if (!allowed.includes(f.type)) continue;
      if (f.size > maxSize) continue;
      newImages.push({
        file: f,
        url: URL.createObjectURL(f),
        isMain: images.length === 0 && newImages.length === 0,
      });
    }

    setImages((prev) => [...prev, ...newImages]);
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      URL.revokeObjectURL(prev[index].url);
      if (prev[index].isMain && updated.length > 0) {
        updated[0].isMain = true;
      }
      return updated;
    });
  };

  const setMainImage = (index: number) => {
    setImages((prev) =>
      prev.map((img, i) => ({ ...img, isMain: i === index }))
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleImageFiles(e.dataTransfer.files);
  };

  /* ---- variant helpers ---- */
  const addVariantOption = () => {
    if (variantOptions.length >= 3) return;
    setVariantOptions((prev) => [...prev, { name: "", values: [] }]);
  };

  const updateVariantOptionName = (index: number, name: string) => {
    setVariantOptions((prev) =>
      prev.map((opt, i) => (i === index ? { ...opt, name } : opt))
    );
  };

  const updateVariantOptionValues = (index: number, raw: string) => {
    const values = raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    setVariantOptions((prev) =>
      prev.map((opt, i) => (i === index ? { ...opt, values } : opt))
    );
  };

  const removeVariantOption = (index: number) => {
    setVariantOptions((prev) => prev.filter((_, i) => i !== index));
  };

  /* auto-generate variant combinations */
  useEffect(() => {
    const validOpts = variantOptions.filter(
      (o) => o.name.trim() && o.values.length > 0
    );
    if (validOpts.length === 0) {
      setVariantRows([]);
      return;
    }

    const combos: string[][] = validOpts.reduce<string[][]>(
      (acc, opt) => {
        if (acc.length === 0) return opt.values.map((v) => [v]);
        const result: string[][] = [];
        for (const existing of acc) {
          for (const val of opt.values) {
            result.push([...existing, val]);
          }
        }
        return result;
      },
      []
    );

    setVariantRows((prev) => {
      return combos.map((combo) => {
        const combination = combo.join(" / ");
        const existing = prev.find((r) => r.combination === combination);
        return (
          existing ?? {
            combination,
            sku: "",
            barcode: "",
            price: "",
            stock: "",
            available: true,
          }
        );
      });
    });
  }, [variantOptions]);

  const updateVariantRow = (
    index: number,
    field: keyof VariantRow,
    value: string | boolean
  ) => {
    setVariantRows((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, [field]: value } : r
      )
    );
  };

  /* ---- pricing calculations ---- */
  const profit = useMemo(() => {
    const p = parseFloat(form.price);
    const c = parseFloat(form.costPerItem);
    if (!isNaN(p) && !isNaN(c)) return p - c;
    return null;
  }, [form.price, form.costPerItem]);

  const margin = useMemo(() => {
    const p = parseFloat(form.price);
    if (profit !== null && !isNaN(p) && p > 0) {
      return ((profit / p) * 100).toFixed(1);
    }
    return null;
  }, [form.price, profit]);

  /* ---- SEO preview ---- */
  const seoPreviewTitle = form.seoTitle || form.title || "Product title";
  const seoPreviewDesc =
    form.metaDescription || form.description?.slice(0, 160) || "Product description will appear here...";
  const seoPreviewUrl = `shopora.com/products/${form.urlHandle || "product-url"}`;

  /* ---- form validation & submission ---- */
  const validate = (): string[] => {
    const errs: string[] = [];
    if (!form.title.trim()) errs.push("Product title is required.");
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) errs.push("Valid selling price is required.");
    if (form.compareAtPrice && parseFloat(form.compareAtPrice) < 0) errs.push("Compare-at price cannot be negative.");
    if (form.costPerItem && parseFloat(form.costPerItem) < 0) errs.push("Cost per item cannot be negative.");
    if (locations.length > 0) {
      const totalLocStock = Object.values(locationStock).reduce((s, v) => s + v, 0);
      if (totalLocStock < 0) errs.push("Stock cannot be negative.");
    } else {
      const stock = parseInt(form.stock, 10);
      if (isNaN(stock) || stock < 0) errs.push("Available stock is required (>= 0).");
    }
    if (!form.categoryId) errs.push("Please select a category.");
    return errs;
  };

  const handleSubmit = async (overrideStatus?: string) => {
    const validationErrors = validate();
    if (validationErrors.length) {
      setErrors(validationErrors);
      showToast(validationErrors[0], "error");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setErrors([]);
    setSuccess(null);
    setSubmitting(true);

    const status = overrideStatus ?? form.status;

    try {
      /* 1. Insert product */
      const { data: newProduct, error: productError } = await supabase
        .from("products")
        .insert({
          name: form.title.trim(),
          description: form.description.trim() || null,
          brand: form.brand.trim() || null,
          category_id: form.categoryId || null,
          seller_id: sellerId,
          status: status === "active" ? "approved" : "draft",
        })
        .select("id")
        .single();

      if (productError || !newProduct) {
        setErrors([`Failed to create product: ${productError?.message ?? "Unknown error"}`]);
        showToast(`Failed to create product: ${productError?.message ?? "Unknown error"}`, "error");
        setSubmitting(false);
        return;
      }

      const productId = newProduct.id;

      /* 2. Upload images to local filesystem, then save record to DB */
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const formDataUpload = new FormData();
        formDataUpload.append("file", img.file);
        formDataUpload.append("productId", productId);

        try {
          const uploadRes = await fetch("/api/upload-image", {
            method: "POST",
            body: formDataUpload,
          });
          const uploadData = await uploadRes.json();

          if (uploadRes.ok && uploadData.storagePath) {
            // RLS policy now allows sellers to insert their own product images
            await supabase.from("product_images").insert({
              product_id: productId,
              storage_path: uploadData.storagePath,
              alt_text: form.title.trim(),
              is_representative: img.isMain,
              order: i,
            });
          }
        } catch {
          /* image upload failures are non-blocking */
        }
      }

      /* 3. Insert variants */
      if (variantRows.length > 0) {
        const validOpts = variantOptions.filter(
          (o) => o.name.trim() && o.values.length > 0
        );
        const variantInserts = variantRows.map((v) => {
          const parts = v.combination.split(" / ");
          return {
            product_id: productId,
            title: v.combination,
            sku: v.sku || null,
            barcode: v.barcode || null,
            price: v.price ? parseFloat(v.price) : null,
            stock: v.stock ? parseInt(v.stock, 10) : 0,
            is_available: v.available,
            option1_name: validOpts[0]?.name || null,
            option1_value: parts[0] || null,
            option2_name: validOpts[1]?.name || null,
            option2_value: parts[1] || null,
            option3_name: validOpts[2]?.name || null,
            option3_value: parts[2] || null,
          };
        });
        const { error: variantError } = await supabase.from("product_variants").insert(variantInserts);
        if (variantError) {
          setErrors([`Product created but variants failed: ${variantError.message}`]);
          showToast(`Product created but variants failed: ${variantError.message}`, "error");
          setSubmitting(false);
          return;
        }
      }

      /* 4. Create seller listing */
      const { data: newListing, error: listingError } = await supabase
        .from("seller_listings")
        .insert({
          seller_id: sellerId,
          product_id: productId,
          price: parseFloat(form.price),
          stock: parseInt(form.stock, 10),
          status: status === "active" ? "active" : "pending",
          shipping_info: form.shippingFee
            ? {
                details: [
                  form.shippingFee && `Shipping: INR ${form.shippingFee}`,
                  form.processingTime && `Processing: ${form.processingTime}`,
                  form.deliveryDuration && `Delivery: ${form.deliveryDuration}`,
                ]
                  .filter(Boolean)
                  .join(". "),
              }
            : null,
        })
        .select("id")
        .single();

      if (listingError || !newListing) {
        setErrors([`Product created but listing failed: ${listingError?.message ?? "Unknown error"}`]);
        showToast(`Product created but listing failed: ${listingError?.message ?? "Unknown error"}`, "error");
        setSubmitting(false);
        return;
      }

      /* 5. Create per-location inventory via RPC (atomic, SECURITY DEFINER) */
      if (locations.length > 0) {
        for (const loc of locations) {
          const qty = locationStock[loc.id] ?? 0;
          const { error: rpcErr } = await supabase.rpc("adjust_location_inventory", {
            p_location_id: loc.id,
            p_listing_id: newListing.id,
            p_adjustment_type: "set",
            p_quantity_change: qty,
            p_reason: "New product creation",
          });
          if (rpcErr) {
            console.error("adjust_location_inventory RPC error:", rpcErr);
          }
        }
      }

      /* 6. Stock sync is handled by the RPC automatically */

      setSuccess("Product created successfully!");
      showToast("Product created successfully!", "success");
      setTimeout(() => router.push("/seller/products"), 1500);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "An unexpected error occurred."]);
      showToast(err instanceof Error ? err.message : "An unexpected error occurred.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  /* ---- loading & auth states ---- */
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-md text-center space-y-4">
          <p className="text-sm text-red-600 font-medium">{authError}</p>
          <Link
            href="/seller"
            className="inline-block bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-600"
          >
            Go to Seller Portal
          </Link>
        </div>
      </div>
    );
  }

  /* ---- render ---- */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/seller/products"
              className="text-gray-500 hover:text-gray-900 transition"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">
              Add product
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSubmit("draft")}
              disabled={submitting}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Save as Draft
            </button>
            <button
              onClick={() => handleSubmit("active")}
              disabled={submitting}
              className="bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
            >
              {submitting ? "Publishing..." : "Publish Product"}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        {/* Alerts */}
        {errors.length > 0 && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            {errors.map((err, i) => (
              <p key={i} className="text-sm text-red-700">{err}</p>
            ))}
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ============ LEFT COLUMN ============ */}
          <div className="flex-1 lg:w-2/3 space-y-6">
            {/* --- Product Information --- */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Product information
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setAndSyncSeo(e.target.value)}
                    placeholder="Short sleeve t-shirt"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Description
                  </label>
                  <textarea
                    rows={4}
                    value={form.description}
                    onChange={(e) => setAndSyncMetaDesc(e.target.value)}
                    placeholder="Write a detailed description of your product..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <BrandSelector
                      value={form.brand}
                      onChange={(brand) => set("brand", brand)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">
                      Product type
                    </label>
                    <input
                      type="text"
                      value={form.productType}
                      onChange={(e) => set("productType", e.target.value)}
                      placeholder="T-shirt, Phone case, etc."
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {form.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 rounded-full px-3 py-1 text-xs font-medium"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="text-indigo-400 hover:text-indigo-600 font-bold"
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={form.tagsInput}
                    onChange={(e) => set("tagsInput", e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder="Type a tag and press Enter or comma to add"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* --- Media --- */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Media
              </h2>

              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-10 w-10 mx-auto text-gray-400 mb-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-sm text-gray-600 font-medium">
                  Drag & drop images here, or click to browse
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  JPEG, PNG, WebP, AVIF up to 5MB each. Max 10 images.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="hidden"
                  onChange={(e) => {
                    handleImageFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>

              {images.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-4">
                  {images.map((img, i) => (
                    <div key={i} className="relative group rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={img.url}
                        alt={`Preview ${i + 1}`}
                        className="w-full h-24 object-cover"
                      />
                      {/* Star icon for main image */}
                      <button
                        type="button"
                        onClick={() => setMainImage(i)}
                        className={`absolute top-1 left-1 p-1 rounded-full transition ${
                          img.isMain
                            ? "bg-yellow-400 text-white"
                            : "bg-white/80 text-gray-400 opacity-0 group-hover:opacity-100"
                        }`}
                        title={img.isMain ? "Main image" : "Set as main image"}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3.5 w-3.5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </button>
                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-white/80 text-gray-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                        title="Remove image"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3.5 w-3.5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                      {img.isMain && (
                        <span className="absolute bottom-0 left-0 right-0 bg-yellow-400/90 text-center text-[10px] font-bold text-white py-0.5">
                          MAIN
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* --- Pricing --- */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Pricing
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Selling price (INR) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.price}
                      onChange={(e) => set("price", e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Compare-at price
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.compareAtPrice}
                      onChange={(e) => set("compareAtPrice", e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Cost per item
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.costPerItem}
                      onChange={(e) => set("costPerItem", e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Profit & Margin display */}
              {profit !== null && (
                <div className="mt-4 flex gap-6 text-sm">
                  <div>
                    <span className="text-gray-500">Profit:</span>{" "}
                    <span className={`font-semibold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      ₹{profit.toFixed(2)}
                    </span>
                  </div>
                  {margin !== null && (
                    <div>
                      <span className="text-gray-500">Margin:</span>{" "}
                      <span className={`font-semibold ${parseFloat(margin) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {margin}%
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.taxApplicable}
                    onChange={(e) => set("taxApplicable", e.target.checked)}
                    className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-300"
                  />
                  Charge tax on this product
                </label>
              </div>
            </div>

            {/* --- Inventory --- */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Inventory
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    SKU (Stock Keeping Unit)
                  </label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={(e) => set("sku", e.target.value)}
                    placeholder="SKU-001"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Barcode (ISBN, UPC, GTIN, etc.)
                  </label>
                  <input
                    type="text"
                    value={form.barcode}
                    onChange={(e) => set("barcode", e.target.value)}
                    placeholder="1234567890123"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                  />
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.trackQuantity}
                    onChange={(e) => set("trackQuantity", e.target.checked)}
                    className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-300"
                  />
                  Track quantity
                </label>

                {form.trackQuantity && (
                  <div className="mt-3 space-y-4">
                    {locations.length > 0 ? (
                      <>
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="text-left px-4 py-2.5 font-medium text-gray-700">Location</th>
                                <th className="text-right px-4 py-2.5 font-medium text-gray-700 w-32">Available</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {locations.map((loc) => (
                                <tr key={loc.id} className="hover:bg-gray-50/50">
                                  <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-900">{loc.name}</span>
                                      {loc.is_default && (
                                        <span className="text-[10px] font-medium bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">Default</span>
                                      )}
                                      <span className="text-[10px] text-gray-400 capitalize">{loc.type.replace("_", " ")}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={locationStock[loc.id] ?? 0}
                                      onChange={(e) => {
                                        const val = Math.max(0, parseInt(e.target.value) || 0);
                                        setLocationStock((prev) => ({ ...prev, [loc.id]: val }));
                                        const total = Object.entries({ ...locationStock, [loc.id]: val })
                                          .reduce((sum, [, v]) => sum + v, 0);
                                        set("stock", String(total));
                                      }}
                                      placeholder="0"
                                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-right focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-gray-50 border-t border-gray-200">
                              <tr>
                                <td className="px-4 py-2.5 font-medium text-gray-900">Total</td>
                                <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                                  {Object.values(locationStock).reduce((sum, v) => sum + v, 0)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                        <p className="text-xs text-gray-500">
                          Set stock for each location. The total is saved as the product&apos;s available stock.
                        </p>
                      </>
                    ) : (
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                          Available stock <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={form.stock}
                          onChange={(e) => set("stock", e.target.value)}
                          placeholder="0"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                          Low stock threshold
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={form.lowStockThreshold}
                          onChange={(e) => set("lowStockThreshold", e.target.value)}
                          placeholder="5"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.continueSellingOutOfStock}
                    onChange={(e) =>
                      set("continueSellingOutOfStock", e.target.checked)
                    }
                    className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-300"
                  />
                  Continue selling when out of stock
                </label>
              </div>
            </div>

            {/* --- Shipping --- */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Shipping
              </h2>

              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mb-4">
                <input
                  type="checkbox"
                  checked={form.isPhysical}
                  onChange={(e) => set("isPhysical", e.target.checked)}
                  className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-300"
                />
                This is a physical product
              </label>

              {form.isPhysical && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="col-span-1">
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Weight
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.weight}
                        onChange={(e) => set("weight", e.target.value)}
                        placeholder="0.0"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Unit
                      </label>
                      <select
                        value={form.weightUnit}
                        onChange={(e) => set("weightUnit", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                      >
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="lb">lb</option>
                        <option value="oz">oz</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Shipping fee (INR)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                          ₹
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.shippingFee}
                          onChange={(e) => set("shippingFee", e.target.value)}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">
                      Package dimensions (cm)
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={form.dimensionL}
                        onChange={(e) => set("dimensionL", e.target.value)}
                        placeholder="Length"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={form.dimensionW}
                        onChange={(e) => set("dimensionW", e.target.value)}
                        placeholder="Width"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={form.dimensionH}
                        onChange={(e) => set("dimensionH", e.target.value)}
                        placeholder="Height"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Country of origin
                      </label>
                      <input
                        type="text"
                        value={form.countryOfOrigin}
                        onChange={(e) => set("countryOfOrigin", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        HS code
                      </label>
                      <input
                        type="text"
                        value={form.hsCode}
                        onChange={(e) => set("hsCode", e.target.value)}
                        placeholder="e.g. 6109.10"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Processing time
                      </label>
                      <input
                        type="text"
                        value={form.processingTime}
                        onChange={(e) => set("processingTime", e.target.value)}
                        placeholder="1-2 business days"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Delivery duration
                      </label>
                      <input
                        type="text"
                        value={form.deliveryDuration}
                        onChange={(e) => set("deliveryDuration", e.target.value)}
                        placeholder="3-7 business days"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">
                      Shipping restrictions
                    </label>
                    <textarea
                      rows={2}
                      value={form.shippingRestrictions}
                      onChange={(e) =>
                        set("shippingRestrictions", e.target.value)
                      }
                      placeholder="e.g. Cannot ship to PO boxes, international restrictions..."
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">
                      Fulfillment notes
                    </label>
                    <textarea
                      rows={2}
                      value={form.fulfillmentNotes}
                      onChange={(e) => set("fulfillmentNotes", e.target.value)}
                      placeholder="Internal notes for fulfillment team..."
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* --- Variants --- */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Variants
                </h2>
                {variantOptions.length < 3 && (
                  <button
                    type="button"
                    onClick={addVariantOption}
                    className="text-sm font-medium text-indigo-500 hover:text-indigo-700"
                  >
                    + Add variant option
                  </button>
                )}
              </div>

              {variantOptions.length === 0 && (
                <p className="text-sm text-gray-500">
                  Add variant options like Size, Color, or Material to create
                  product variants.
                </p>
              )}

              {variantOptions.map((opt, i) => (
                <div key={i} className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">
                      Option {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeVariantOption(i)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={opt.name}
                      onChange={(e) =>
                        updateVariantOptionName(i, e.target.value)
                      }
                      placeholder="Option name (e.g. Size, Color)"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                    />
                    <input
                      type="text"
                      value={opt.values.join(", ")}
                      onChange={(e) =>
                        updateVariantOptionValues(i, e.target.value)
                      }
                      placeholder="Values separated by commas (e.g. S, M, L, XL)"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                    />
                  </div>
                </div>
              ))}

              {variantRows.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                      <tr>
                        <th className="py-2 px-3">Variant</th>
                        <th className="py-2 px-3">SKU</th>
                        <th className="py-2 px-3">Barcode</th>
                        <th className="py-2 px-3">Price override (INR)</th>
                        <th className="py-2 px-3">Stock</th>
                        <th className="py-2 px-3">Available</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {variantRows.map((row, i) => (
                        <tr key={row.combination}>
                          <td className="py-2 px-3 font-medium text-gray-800 text-xs">
                            {row.combination}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.sku || ""}
                              onChange={(e) =>
                                updateVariantRow(i, "sku", e.target.value)
                              }
                              className="w-24 rounded border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.barcode || ""}
                              onChange={(e) =>
                                updateVariantRow(i, "barcode", e.target.value)
                              }
                              placeholder="UPC, EAN..."
                              className="w-28 rounded border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.price ?? ""}
                              onChange={(e) =>
                                updateVariantRow(i, "price", e.target.value)
                              }
                              placeholder="Use default"
                              className="w-28 rounded border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={row.stock ?? ""}
                              onChange={(e) =>
                                updateVariantRow(i, "stock", e.target.value)
                              }
                              placeholder="0"
                              className="w-20 rounded border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="checkbox"
                              checked={row.available}
                              onChange={(e) =>
                                updateVariantRow(
                                  i,
                                  "available",
                                  e.target.checked
                                )
                              }
                              className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-300"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* --- SEO --- */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Search engine listing
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    SEO title
                  </label>
                  <input
                    type="text"
                    value={form.seoTitle}
                    onChange={(e) => set("seoTitle", e.target.value)}
                    placeholder="Product title for search engines"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {form.seoTitle.length}/70 characters
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Meta description
                  </label>
                  <textarea
                    rows={2}
                    value={form.metaDescription}
                    onChange={(e) =>
                      set(
                        "metaDescription",
                        e.target.value.slice(0, 160)
                      )
                    }
                    placeholder="Brief description for search engines..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {form.metaDescription.length}/160 characters
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    URL handle
                  </label>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <span>shopora.com/products/</span>
                    <input
                      type="text"
                      value={form.urlHandle}
                      onChange={(e) =>
                        set("urlHandle", slugify(e.target.value))
                      }
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                    />
                  </div>
                </div>

                {/* Google Preview */}
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2">
                    Search engine preview
                  </p>
                  <p className="text-blue-700 text-base font-medium leading-tight hover:underline cursor-default">
                    {seoPreviewTitle}
                  </p>
                  <p className="text-green-700 text-xs mt-0.5">{seoPreviewUrl}</p>
                  <p className="text-gray-600 text-xs mt-1 line-clamp-2">
                    {seoPreviewDesc}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ============ RIGHT COLUMN ============ */}
          <div className="lg:w-1/3 space-y-6">
            {/* --- Status --- */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Status
              </h2>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
              </select>
            </div>

            {/* --- Product Organization --- */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Product organization
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => set("categoryId", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                  >
                    <option value="">Select a category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Subcategory
                  </label>
                  <input
                    type="text"
                    value={form.subcategory}
                    onChange={(e) => set("subcategory", e.target.value)}
                    placeholder="e.g. Running shoes"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Product type
                  </label>
                  <input
                    type="text"
                    value={form.productType}
                    onChange={(e) => set("productType", e.target.value)}
                    placeholder="e.g. Apparel"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                  />
                </div>

                {form.tags.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {form.tags.map((tag) => (
                        <span
                          key={tag}
                          className="bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5 text-xs font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* --- Publishing --- */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Publishing
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Status</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      form.status === "active"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {form.status === "active" ? "Active" : "Draft"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Created</span>
                  <span className="text-gray-700">
                    {new Date().toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed top-6 right-6 z-[9999]">
          <div className={`flex items-center gap-3 rounded-lg border px-5 py-3.5 shadow-lg ${toast.type === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
            <span className="text-lg">{toast.type === "success" ? "✓" : "✕"}</span>
            <span className="text-sm font-medium">{toast.message}</span>
            <button onClick={() => { if (toastTimer.current) clearTimeout(toastTimer.current); setToast(null); }} className="ml-2 text-current opacity-50 hover:opacity-100">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
