"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/src/lib/supabase/client";
import BrandSelector from "@/src/components/seller/BrandSelector";
import { getProductImageUrl } from "@/src/lib/catalog";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Category = { id: string; name: string };

type VariantOption = {
  name: string;
  values: string[];
};

type VariantRow = {
  id?: string;
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

type LocationStockEntry = {
  location_id: string;
  available: number;
};

type ExistingImage = {
  id: string;
  storage_path: string;
  alt_text: string | null;
  is_representative: boolean;
  order: number | null;
  url: string | null;
};

type NewImage = {
  file: File;
  url: string;
  isMain: boolean;
};

type FormData = {
  title: string;
  description: string;
  brand: string;
  productType: string;
  tagsInput: string;
  tags: string[];
  price: string;
  compareAtPrice: string;
  costPerItem: string;
  taxApplicable: boolean;
  sku: string;
  barcode: string;
  trackQuantity: boolean;
  stock: string;
  continueSellingOutOfStock: boolean;
  lowStockThreshold: string;
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
  seoTitle: string;
  metaDescription: string;
  urlHandle: string;
  status: string;
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

const emptyForm: FormData = {
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

export default function ProductsidEditContent() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  /* Auth & seller state */
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [listingId, setListingId] = useState<string | null>(null);

  /* Categories */
  const [categories, setCategories] = useState<Category[]>([]);

  /* Form */
  const [form, setForm] = useState<FormData>(emptyForm);

  /* Images */
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [newImages, setNewImages] = useState<NewImage[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Locations & per-location stock */
  const [locations, setLocations] = useState<SellerLocation[]>([]);
  const [locationStock, setLocationStock] = useState<Record<string, number>>({});
  /* Per-variant per-location stock: { variantId: { locationId: qty } } */
  const [variantLocationStock, setVariantLocationStock] = useState<Record<string, Record<string, number>>>({});

  /* Variants */
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([]);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);

  /* Submit state */
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);

  /* ---- Toast notification ---- */
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

  /* ---- auth check & data load ---- */
  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setAuthError("Please sign in to edit products.");
        setAuthLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("auth_uid", userData.user.id)
        .maybeSingle();

      if (!profile || (profile.role !== "seller" && profile.role !== "admin")) {
        setAuthError("You do not have seller permissions.");
        setAuthLoading(false);
        return;
      }

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

      setSellerId(seller.id);

      /* Load seller locations */
      const { data: locs } = await supabase
        .from("seller_locations")
        .select("id, name, type, is_default")
        .eq("seller_id", seller.id)
        .eq("is_active", true)
        .order("fulfillment_priority", { ascending: true });
      if (locs && locs.length > 0) setLocations(locs);

      /* Load categories */
      const { data: cats } = await supabase
        .from("categories")
        .select("id, name")
        .order("name");
      if (cats) setCategories(cats);

      /* Load product data */
      const { data: product, error: prodError } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .maybeSingle();

      if (prodError || !product) {
        setAuthError("Product not found.");
        setAuthLoading(false);
        return;
      }

      /* Load listing */
      const { data: listing } = await supabase
        .from("seller_listings")
        .select("id, price, stock, status, created_at, shipping_info")
        .eq("product_id", productId)
        .eq("seller_id", seller.id)
        .maybeSingle();

      /* Load per-location inventory */
      if (listing && locs && locs.length > 0) {
        const { data: locInv, error: locInvErr } = await supabase
          .from("location_inventory")
          .select("location_id, available")
          .eq("listing_id", listing.id)
          .is("variant_id", null);
        if (locInvErr) {
          console.error("Failed to load location inventory:", locInvErr);
          // Don't set stock to 0 on error — leave state unchanged
        } else {
          const stockMap: Record<string, number> = {};
          locs.forEach((loc) => { stockMap[loc.id] = 0; });
          const hasLocInvRecords = locInv && locInv.length > 0;
          if (hasLocInvRecords) {
            locInv.forEach((row) => { stockMap[row.location_id] = row.available ?? 0; });
          } else if (listing.stock > 0) {
            // No location_inventory records yet — show legacy stock at default location
            const defaultLoc = locs.find((l: { is_default: boolean }) => l.is_default) || locs[0];
            if (defaultLoc) {
              stockMap[defaultLoc.id] = Number(listing.stock) || 0;
            }
          }
          setLocationStock(stockMap);
        }
      }

      /* Load images */
      const { data: imgData } = await supabase
        .from("product_images")
        .select("id, storage_path, alt_text, is_representative, order")
        .eq("product_id", productId)
        .order("is_representative", { ascending: false })
        .order("order", { ascending: true });

      const existingImgs: ExistingImage[] = (imgData ?? []).map((img) => ({
        ...img,
        order: img.order ?? null,
        url: getProductImageUrl(img.storage_path),
      }));
      setExistingImages(existingImgs);

      /* Load variants */
      const { data: variantsData } = await supabase
        .from("product_variants")
        .select("id, title, sku, barcode, price, stock, is_available, option1_name, option1_value, option2_name, option2_value, option3_name, option3_value")
        .eq("product_id", productId);

      if (variantsData && variantsData.length > 0) {
        /* reconstruct options from stored option names/values */
        const optNames: (string | null)[] = [
          variantsData[0]?.option1_name,
          variantsData[0]?.option2_name,
          variantsData[0]?.option3_name,
        ];
        const opts: VariantOption[] = [];
        for (let i = 0; i < 3; i++) {
          const name = optNames[i];
          if (!name) continue;
          const key = `option${i + 1}_value` as "option1_value" | "option2_value" | "option3_value";
          const uniqueVals = [...new Set(variantsData.map((v) => v[key]).filter(Boolean))] as string[];
          opts.push({ name, values: uniqueVals });
        }
        setVariantOptions(opts);

        setVariantRows(
          variantsData.map((v) => ({
            id: v.id,
            combination: v.title,
            sku: v.sku ?? "",
            barcode: v.barcode ?? "",
            price: v.price != null ? String(v.price) : "",
            stock: String(v.stock ?? 0),
            available: v.is_available ?? true,
          }))
        );
      }

      /* Load per-variant per-location inventory */
      if (listing && locs && locs.length > 0 && variantsData && variantsData.length > 0) {
        const { data: varLocInv, error: varLocInvErr } = await supabase
          .from("location_inventory")
          .select("location_id, available, variant_id")
          .eq("listing_id", listing.id)
          .not("variant_id", "is", null);
        if (varLocInvErr) {
          console.error("Failed to load variant location inventory:", varLocInvErr);
        } else {
          const vlStock: Record<string, Record<string, number>> = {};
          variantsData.forEach((v) => {
            vlStock[v.id] = {};
            locs.forEach((loc) => { vlStock[v.id][loc.id] = 0; });
          });
          if (varLocInv && varLocInv.length > 0) {
            varLocInv.forEach((row) => {
              if (row.variant_id && vlStock[row.variant_id]) {
                vlStock[row.variant_id][row.location_id] = row.available ?? 0;
              }
            });
          }
          setVariantLocationStock(vlStock);
        }
      }

      /* Populate form */
      const productStatus =
        listing?.status === "active" && product.status === "approved"
          ? "active"
          : "draft";

      setForm({
        title: product.name ?? "",
        description: product.description ?? "",
        brand: product.brand ?? "",
        productType: product.product_type ?? "",
        tagsInput: "",
        tags: Array.isArray(product.tags) ? product.tags : [],
        price: listing ? String(listing.price) : "",
        compareAtPrice: product.compare_at_price
          ? String(product.compare_at_price)
          : product.catalog_reference_price
            ? String(product.catalog_reference_price)
            : "",
        costPerItem: product.cost_per_item ? String(product.cost_per_item) : "",
        taxApplicable: product.tax_applicable ?? true,
        sku: product.sku ?? "",
        barcode: product.barcode ?? "",
        trackQuantity: product.track_quantity ?? true,
        stock: listing ? String(listing.stock) : "0",
        continueSellingOutOfStock: product.continue_selling_when_oos ?? false,
        lowStockThreshold: product.low_stock_threshold ? String(product.low_stock_threshold) : "5",
        isPhysical: product.is_physical_product ?? true,
        weight: product.weight ? String(product.weight) : "",
        weightUnit: product.weight_unit ?? "kg",
        dimensionL: product.package_length ? String(product.package_length) : "",
        dimensionW: product.package_width ? String(product.package_width) : "",
        dimensionH: product.package_height ? String(product.package_height) : "",
        countryOfOrigin: product.country_of_origin ?? "India",
        hsCode: product.hs_code ?? "",
        shippingFee: product.shipping_fee ? String(product.shipping_fee) : "",
        processingTime: product.processing_time ?? "1-2 business days",
        deliveryDuration: product.delivery_duration ?? "3-7 business days",
        shippingRestrictions: product.shipping_restrictions ?? "",
        fulfillmentNotes: product.fulfillment_notes ?? "",
        seoTitle: product.seo_title ?? product.name ?? "",
        metaDescription: product.meta_description ?? (product.description ?? "").slice(0, 160),
        urlHandle: product.url_handle ?? slugify(product.name ?? ""),
        status: productStatus,
        categoryId: product.category_id ?? "",
        subcategory: product.subcategory ?? "",
      });

      setListingId(listing?.id ?? null);
      setCreatedAt(listing?.created_at ?? product.created_at ?? null);

      setAuthLoading(false);
      setDataLoading(false);
    })();
  }, [productId]);

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
  const totalImages =
    existingImages.filter((img) => !removedImageIds.includes(img.id)).length +
    newImages.length;

  const handleImageFiles = (files: FileList | null) => {
    if (!files) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    const maxSize = 5 * 1024 * 1024;
    const remaining = 10 - totalImages;
    const added: NewImage[] = [];

    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const f = files[i];
      if (!allowed.includes(f.type)) continue;
      if (f.size > maxSize) continue;
      added.push({
        file: f,
        url: URL.createObjectURL(f),
        isMain: false,
      });
    }

    setNewImages((prev) => [...prev, ...added]);
  };

  const removeExistingImage = (id: string) => {
    setRemovedImageIds((prev) => [...prev, id]);
  };

  const removeNewImage = (index: number) => {
    setNewImages((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const setExistingMain = (id: string) => {
    setExistingImages((prev) =>
      prev.map((img) => ({ ...img, is_representative: img.id === id }))
    );
    setNewImages((prev) => prev.map((img) => ({ ...img, isMain: false })));
  };

  const setNewMain = (index: number) => {
    setExistingImages((prev) =>
      prev.map((img) => ({ ...img, is_representative: false }))
    );
    setNewImages((prev) =>
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
    const values = raw.split(",").map((v) => v.trim()).filter(Boolean);
    setVariantOptions((prev) =>
      prev.map((opt, i) => (i === index ? { ...opt, values } : opt))
    );
  };

  const removeVariantOption = (index: number) => {
    setVariantOptions((prev) => prev.filter((_, i) => i !== index));
  };

  /* auto-generate variant combos */
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
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
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
    if (profit !== null && !isNaN(p) && p > 0)
      return ((profit / p) * 100).toFixed(1);
    return null;
  }, [form.price, profit]);

  /* ---- SEO preview ---- */
  const seoPreviewTitle = form.seoTitle || form.title || "Product title";
  const seoPreviewDesc =
    form.metaDescription || form.description?.slice(0, 160) || "Product description will appear here...";
  const seoPreviewUrl = `shopora.com/products/${form.urlHandle || "product-url"}`;

  /* ---- validation & save ---- */
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

  const handleSave = async () => {
    const validationErrors = validate();
    if (validationErrors.length) {
      setErrors(validationErrors);
      showToast(`${validationErrors.length} validation error(s) found`, "error");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setErrors([]);
    setSuccess(null);
    setSubmitting(true);

    try {
      /* 1. Update product via server API (bypasses RLS) */
      const productStatus = form.status === "active" ? "approved" : "draft";
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const listingStatus = form.status === "active" ? "active" : "pending";
      const listingPayload = {
        price: parseFloat(form.price),
        stock: parseInt(form.stock, 10),
        status: listingStatus,
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
      };

      const updateRes = await fetch("/api/update-product", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          productId,
          updates: {
            name: form.title.trim(),
            description: form.description.trim() || null,
            brand: form.brand.trim() || null,
            category_id: form.categoryId || null,
            status: productStatus,
            product_type: form.productType.trim() || null,
            tags: form.tags.length > 0 ? form.tags : [],
            subcategory: form.subcategory.trim() || null,
            compare_at_price: form.compareAtPrice ? parseFloat(form.compareAtPrice) : null,
            cost_per_item: form.costPerItem ? parseFloat(form.costPerItem) : null,
            tax_applicable: form.taxApplicable,
            sku: form.sku.trim() || null,
            barcode: form.barcode.trim() || null,
            track_quantity: form.trackQuantity,
            continue_selling_when_oos: form.continueSellingOutOfStock,
            low_stock_threshold: form.lowStockThreshold ? parseInt(form.lowStockThreshold) : 5,
            is_physical_product: form.isPhysical,
            weight: form.weight ? parseFloat(form.weight) : null,
            weight_unit: form.weightUnit || "kg",
            package_length: form.dimensionL ? parseFloat(form.dimensionL) : null,
            package_width: form.dimensionW ? parseFloat(form.dimensionW) : null,
            package_height: form.dimensionH ? parseFloat(form.dimensionH) : null,
            country_of_origin: form.countryOfOrigin.trim() || "India",
            hs_code: form.hsCode.trim() || null,
            shipping_fee: form.shippingFee ? parseFloat(form.shippingFee) : null,
            processing_time: form.processingTime.trim() || null,
            delivery_duration: form.deliveryDuration.trim() || null,
            shipping_restrictions: form.shippingRestrictions.trim() || null,
            fulfillment_notes: form.fulfillmentNotes.trim() || null,
            seo_title: form.seoTitle.trim() || null,
            meta_description: form.metaDescription.trim() || null,
            url_handle: form.urlHandle.trim() || null,
          },
          listingUpdates: listingPayload,
          listingId,
          sellerId,
        }),
      });

      const updateResult = await updateRes.json();
      if (!updateRes.ok) {
        const errMsg = updateResult.error || "Failed to update product";
        setErrors([errMsg]);
        showToast(errMsg, "error");
        setSubmitting(false);
        return;
      }
      // Capture effective listing ID synchronously (React setState is async)
      let effectiveListingId = listingId;
      if (updateResult.newListingId) {
        effectiveListingId = updateResult.newListingId;
        setListingId(updateResult.newListingId);
      }

      /* 2. Handle removed images */
      for (const imgId of removedImageIds) {
        await supabase.from("product_images").delete().eq("id", imgId);
      }

      /* 3. Update is_representative on existing images */
      for (const img of existingImages) {
        if (!removedImageIds.includes(img.id)) {
          await supabase
            .from("product_images")
            .update({ is_representative: img.is_representative })
            .eq("id", img.id);
        }
      }

      /* 4. Upload new images */
      const activeExistingCount = existingImages.filter(
        (img) => !removedImageIds.includes(img.id)
      ).length;

      for (let i = 0; i < newImages.length; i++) {
        const img = newImages[i];
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
            await supabase.from("product_images").insert({
              product_id: productId,
              storage_path: uploadData.storagePath,
              alt_text: form.title.trim(),
              is_representative: img.isMain,
              order: activeExistingCount + i,
            });
          }
        } catch {
          /* non-blocking */
        }
      }

      /* 5. Listing already updated via API above */

      /* 6. Handle variants — upsert to preserve IDs & location_inventory links */
      const validOpts = variantOptions.filter(
        (o) => o.name.trim() && o.values.length > 0
      );
      let finalVariantIds: { id: string; title: string }[] = [];

      // Get existing variants from DB
      const { data: existingDbVariants } = await supabase
        .from("product_variants")
        .select("id, title")
        .eq("product_id", productId);
      const existingMap = new Map((existingDbVariants || []).map((v) => [v.title, v.id]));

      if (variantRows.length > 0) {
        // Separate into updates (existing) and inserts (new)
        const toUpdate: { id: string; data: Record<string, unknown> }[] = [];
        const toInsert: Record<string, unknown>[] = [];
        const currentTitles = new Set<string>();

        for (const v of variantRows) {
          const parts = v.combination.split(" / ");
          currentTitles.add(v.combination);
          const payload = {
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

          const existingId = v.id || existingMap.get(v.combination);
          if (existingId) {
            toUpdate.push({ id: existingId, data: payload });
          } else {
            toInsert.push(payload);
          }
        }

        // Delete removed variants (and their location_inventory via cascade or manual)
        const removedIds = (existingDbVariants || [])
          .filter((v) => !currentTitles.has(v.title))
          .map((v) => v.id);
        if (removedIds.length > 0) {
          await supabase.from("location_inventory").delete().in("variant_id", removedIds);
          await supabase.from("product_variants").delete().in("id", removedIds);
        }

        // Update existing variants (preserves IDs)
        for (const item of toUpdate) {
          await supabase.from("product_variants").update(item.data).eq("id", item.id);
          finalVariantIds.push({ id: item.id, title: item.data.title as string });
        }

        // Insert new variants
        if (toInsert.length > 0) {
          const { data: newVariants, error: variantError } = await supabase
            .from("product_variants")
            .insert(toInsert)
            .select("id, title");
          if (variantError) {
            const errMsg = `Product updated but variants failed: ${variantError.message}`;
            setErrors([errMsg]);
            showToast(errMsg, "error");
            setSubmitting(false);
            return;
          }
          finalVariantIds.push(...(newVariants || []));
        }
      } else {
        // No variants — delete all existing
        if (existingDbVariants && existingDbVariants.length > 0) {
          const ids = existingDbVariants.map((v) => v.id);
          await supabase.from("location_inventory").delete().in("variant_id", ids);
          await supabase.from("product_variants").delete().eq("product_id", productId);
        }
      }

      /* 7. Upsert per-location inventory via RPC (SECURITY DEFINER, atomic) */
      const finalListingId = effectiveListingId;
      const inventoryErrors: string[] = [];
      if (locations.length > 0 && finalListingId) {
        if (variantRows.length > 0 && finalVariantIds.length > 0) {
          /* Per-variant per-location inventory */
          for (const fv of finalVariantIds) {
            const matchingRow = variantRows.find((r) => r.combination === fv.title);
            // Try multiple keys: the variant's DB id, the matching row's id,
            // the combination title, or the matching row's combination
            const vlStock = variantLocationStock[fv.id]
              || (matchingRow?.id ? variantLocationStock[matchingRow.id] : undefined)
              || variantLocationStock[fv.title]
              || (matchingRow?.combination ? variantLocationStock[matchingRow.combination] : undefined)
              || {};

            for (const loc of locations) {
              const qty = vlStock[loc.id] ?? 0;
              const { error: rpcErr } = await supabase.rpc("adjust_location_inventory", {
                p_location_id: loc.id,
                p_listing_id: finalListingId,
                p_adjustment_type: "set",
                p_quantity_change: qty,
                p_reason: "Product edit save",
                p_variant_id: fv.id,
              });
              if (rpcErr) {
                console.error("adjust_location_inventory RPC error:", rpcErr);
                inventoryErrors.push(`Stock save failed for ${fv.title} at ${loc.name}: ${rpcErr.message}`);
              }
            }
          }
        } else {
          /* Product-level (no variants) per-location inventory */
          for (const loc of locations) {
            const qty = locationStock[loc.id] ?? 0;
            const { error: rpcErr } = await supabase.rpc("adjust_location_inventory", {
              p_location_id: loc.id,
              p_listing_id: finalListingId,
              p_adjustment_type: "set",
              p_quantity_change: qty,
              p_reason: "Product edit save",
            });
            if (rpcErr) {
              console.error("adjust_location_inventory RPC error:", rpcErr);
              inventoryErrors.push(`Stock save failed at ${loc.name}: ${rpcErr.message}`);
            }
          }
        }
      }
      if (inventoryErrors.length > 0) {
        console.error("Inventory save errors:", inventoryErrors);
        setErrors(inventoryErrors);
        showToast("Failed to save inventory. Check errors above.", "error");
        setSubmitting(false);
        return;
      }

      /* 8. Stock sync is handled by the RPC (adjust_location_inventory syncs
         seller_listings.stock and product_variants.stock automatically) */

      setSuccess("Product updated successfully!");
      showToast("Product updated successfully!", "success");
      setRemovedImageIds([]);
      setNewImages([]);
      window.scrollTo({ top: 0, behavior: "smooth" });

      /* Reload data from DB to confirm persistence */
      const { data: freshProduct } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      // Reload listing to get synced stock
      const { data: freshListing } = await supabase
        .from("seller_listings")
        .select("id, stock")
        .eq("id", finalListingId)
        .maybeSingle();

      if (freshProduct) {
        setForm((prev) => ({
          ...prev,
          title: freshProduct.name ?? "",
          description: freshProduct.description ?? "",
          brand: freshProduct.brand ?? "",
          productType: freshProduct.product_type ?? "",
          tags: Array.isArray(freshProduct.tags) ? freshProduct.tags : [],
          compareAtPrice: freshProduct.compare_at_price ? String(freshProduct.compare_at_price) : "",
          costPerItem: freshProduct.cost_per_item ? String(freshProduct.cost_per_item) : "",
          taxApplicable: freshProduct.tax_applicable ?? true,
          sku: freshProduct.sku ?? "",
          barcode: freshProduct.barcode ?? "",
          trackQuantity: freshProduct.track_quantity ?? true,
          stock: freshListing ? String(freshListing.stock) : prev.stock,
          continueSellingOutOfStock: freshProduct.continue_selling_when_oos ?? false,
          lowStockThreshold: freshProduct.low_stock_threshold ? String(freshProduct.low_stock_threshold) : "5",
          isPhysical: freshProduct.is_physical_product ?? true,
          weight: freshProduct.weight ? String(freshProduct.weight) : "",
          weightUnit: freshProduct.weight_unit ?? "kg",
          dimensionL: freshProduct.package_length ? String(freshProduct.package_length) : "",
          dimensionW: freshProduct.package_width ? String(freshProduct.package_width) : "",
          dimensionH: freshProduct.package_height ? String(freshProduct.package_height) : "",
          countryOfOrigin: freshProduct.country_of_origin ?? "India",
          hsCode: freshProduct.hs_code ?? "",
          shippingFee: freshProduct.shipping_fee ? String(freshProduct.shipping_fee) : "",
          processingTime: freshProduct.processing_time ?? "1-2 business days",
          deliveryDuration: freshProduct.delivery_duration ?? "3-7 business days",
          shippingRestrictions: freshProduct.shipping_restrictions ?? "",
          fulfillmentNotes: freshProduct.fulfillment_notes ?? "",
          seoTitle: freshProduct.seo_title ?? freshProduct.name ?? "",
          metaDescription: freshProduct.meta_description ?? "",
          urlHandle: freshProduct.url_handle ?? "",
          categoryId: freshProduct.category_id ?? "",
          subcategory: freshProduct.subcategory ?? "",
        }));
      }

      /* ── Post-save: keep the form state as-is (already correct) ──
         Previously we reloaded location_inventory from DB here, but that
         caused a race condition: the reload initialized all locations to 0,
         then populated from a query that could return stale data (Supabase
         read-after-write latency). The RPC calls above already saved the
         exact values the user entered, so there's nothing to reload.

         Only reload variant rows (IDs may have changed for new variants). */
      if (finalVariantIds.length > 0) {
        const { data: freshVariants } = await supabase
          .from("product_variants")
          .select("id, title, sku, barcode, price, stock, is_available, option1_name, option1_value, option2_name, option2_value, option3_name, option3_value")
          .eq("product_id", productId);
        if (freshVariants && freshVariants.length > 0) {
          // Build a mapping from old combination key -> new DB id
          const titleToNewId: Record<string, string> = {};
          freshVariants.forEach((v) => { titleToNewId[v.title] = v.id; });

          setVariantRows(
            freshVariants.map((v) => ({
              id: v.id,
              combination: v.title,
              sku: v.sku ?? "",
              barcode: v.barcode ?? "",
              price: v.price != null ? String(v.price) : "",
              stock: String(v.stock ?? 0),
              available: v.is_available ?? true,
            }))
          );

          // Re-key variantLocationStock from old keys to new DB ids
          // so the UI shows the correct stock after save
          setVariantLocationStock((prev) => {
            const updated: Record<string, Record<string, number>> = {};
            freshVariants.forEach((v) => {
              // Try to find existing stock data by new id, old id, or combination title
              const existing = prev[v.id]
                || Object.entries(prev).find(([key]) => {
                  // Match by combination title (handles case where key was the title)
                  const oldRow = variantRows.find((r) => r.id === key || r.combination === key);
                  return oldRow?.combination === v.title;
                })?.[1]
                || {};
              updated[v.id] = {};
              locations.forEach((loc) => {
                updated[v.id][loc.id] = existing[loc.id] ?? 0;
              });
            });
            return updated;
          });
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrors([errMsg]);
      showToast(errMsg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  /* ---- delete product ---- */
  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to permanently delete this product? This cannot be undone."
      )
    )
      return;

    setDeleting(true);
    try {
      await supabase.from("product_variants").delete().eq("product_id", productId);
      await supabase.from("product_images").delete().eq("product_id", productId);
      if (listingId) {
        await supabase.from("seller_listings").delete().eq("id", listingId);
      }
      await supabase.from("products").delete().eq("id", productId);
      router.push("/seller/products");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to delete product.";
      setErrors([errMsg]);
      showToast(errMsg, "error");
      setDeleting(false);
    }
  };

  /* ---- loading & auth states ---- */
  if (authLoading || dataLoading) {
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
            href="/seller/products"
            className="inline-block bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-600"
          >
            Back to Products
          </Link>
        </div>
      </div>
    );
  }

  const visibleExistingImages = existingImages.filter(
    (img) => !removedImageIds.includes(img.id)
  );

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
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">
              {form.title || "Edit product"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting || submitting}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
            <button
              onClick={handleSave}
              disabled={submitting}
              className="bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save changes"}
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
                    onChange={(e) => set("title", e.target.value)}
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
                    onChange={(e) => set("description", e.target.value)}
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
                    placeholder="Type a tag and press Enter"
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
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-gray-600 font-medium">
                  Drag & drop images here, or click to browse
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  JPEG, PNG, WebP, AVIF up to 5MB each. {totalImages}/10 images.
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

              {(visibleExistingImages.length > 0 || newImages.length > 0) && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-4">
                  {/* Existing images */}
                  {visibleExistingImages.map((img) => (
                    <div
                      key={img.id}
                      className="relative group rounded-lg overflow-hidden border border-gray-200"
                    >
                      <img
                        src={img.url || ""}
                        alt={img.alt_text || "Product image"}
                        className="w-full h-24 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setExistingMain(img.id)}
                        className={`absolute top-1 left-1 p-1 rounded-full transition ${
                          img.is_representative
                            ? "bg-yellow-400 text-white"
                            : "bg-white/80 text-gray-400 opacity-0 group-hover:opacity-100"
                        }`}
                        title={img.is_representative ? "Main image" : "Set as main"}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeExistingImage(img.id)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-white/80 text-gray-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                        title="Remove image"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                      {img.is_representative && (
                        <span className="absolute bottom-0 left-0 right-0 bg-yellow-400/90 text-center text-[10px] font-bold text-white py-0.5">
                          MAIN
                        </span>
                      )}
                    </div>
                  ))}

                  {/* New images */}
                  {newImages.map((img, i) => (
                    <div
                      key={`new-${i}`}
                      className="relative group rounded-lg overflow-hidden border border-blue-200"
                    >
                      <img
                        src={img.url}
                        alt={`New ${i + 1}`}
                        className="w-full h-24 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setNewMain(i)}
                        className={`absolute top-1 left-1 p-1 rounded-full transition ${
                          img.isMain
                            ? "bg-yellow-400 text-white"
                            : "bg-white/80 text-gray-400 opacity-0 group-hover:opacity-100"
                        }`}
                        title={img.isMain ? "Main image" : "Set as main"}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeNewImage(i)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-white/80 text-gray-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                      {img.isMain && (
                        <span className="absolute bottom-0 left-0 right-0 bg-yellow-400/90 text-center text-[10px] font-bold text-white py-0.5">
                          MAIN
                        </span>
                      )}
                      <span className="absolute bottom-0 right-0 bg-blue-500/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-tl">
                        NEW
                      </span>
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
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.price}
                      onChange={(e) => set("price", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Compare-at price
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.compareAtPrice}
                      onChange={(e) => set("compareAtPrice", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Cost per item
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.costPerItem}
                      onChange={(e) => set("costPerItem", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                    />
                  </div>
                </div>
              </div>

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
                  <label className="text-sm font-medium text-gray-700 block mb-1">SKU</label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={(e) => set("sku", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Barcode</label>
                  <input
                    type="text"
                    value={form.barcode}
                    onChange={(e) => set("barcode", e.target.value)}
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
                    {locations.length > 0 && variantRows.length > 0 ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                        <p className="text-sm text-blue-800 font-medium">Stock is tracked per variant</p>
                        <p className="text-xs text-blue-600 mt-1">
                          Set stock for each variant at each location in the Variants section below.
                        </p>
                      </div>
                    ) : locations.length > 0 ? (
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
                                        // Sync total to form.stock
                                        const total = Object.entries({ ...locationStock, [loc.id]: val })
                                          .reduce((sum, [, v]) => sum + v, 0);
                                        set("stock", String(total));
                                      }}
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
                    onChange={(e) => set("continueSellingOutOfStock", e.target.checked)}
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
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Weight</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.weight}
                        onChange={(e) => set("weight", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Unit</label>
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
                      <label className="text-sm font-medium text-gray-700 block mb-1">Shipping fee (INR)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.shippingFee}
                          onChange={(e) => set("shippingFee", e.target.value)}
                          className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Package dimensions (cm)</label>
                    <div className="grid grid-cols-3 gap-3">
                      <input type="number" min="0" step="0.1" value={form.dimensionL} onChange={(e) => set("dimensionL", e.target.value)} placeholder="Length" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none" />
                      <input type="number" min="0" step="0.1" value={form.dimensionW} onChange={(e) => set("dimensionW", e.target.value)} placeholder="Width" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none" />
                      <input type="number" min="0" step="0.1" value={form.dimensionH} onChange={(e) => set("dimensionH", e.target.value)} placeholder="Height" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Country of origin</label>
                      <input type="text" value={form.countryOfOrigin} onChange={(e) => set("countryOfOrigin", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">HS code</label>
                      <input type="text" value={form.hsCode} onChange={(e) => set("hsCode", e.target.value)} placeholder="e.g. 6109.10" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Processing time</label>
                      <input type="text" value={form.processingTime} onChange={(e) => set("processingTime", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Delivery duration</label>
                      <input type="text" value={form.deliveryDuration} onChange={(e) => set("deliveryDuration", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none" />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Shipping restrictions</label>
                    <textarea rows={2} value={form.shippingRestrictions} onChange={(e) => set("shippingRestrictions", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none" />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Fulfillment notes</label>
                    <textarea rows={2} value={form.fulfillmentNotes} onChange={(e) => set("fulfillmentNotes", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none" />
                  </div>
                </div>
              )}
            </div>

            {/* --- Variants --- */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Variants</h2>
                {variantOptions.length < 3 && (
                  <button type="button" onClick={addVariantOption} className="text-sm font-medium text-indigo-500 hover:text-indigo-700">
                    + Add variant option
                  </button>
                )}
              </div>

              {variantOptions.length === 0 && (
                <p className="text-sm text-gray-500">
                  Add variant options like Size, Color, or Material to create product variants.
                </p>
              )}

              {variantOptions.map((opt, i) => (
                <div key={i} className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Option {i + 1}</span>
                    <button type="button" onClick={() => removeVariantOption(i)} className="text-xs text-red-500 hover:text-red-700 font-medium">
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input type="text" value={opt.name} onChange={(e) => updateVariantOptionName(i, e.target.value)} placeholder="Option name (e.g. Size)" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none" />
                    <input type="text" value={opt.values.join(", ")} onChange={(e) => updateVariantOptionValues(i, e.target.value)} placeholder="Values (e.g. S, M, L)" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none" />
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
                        {locations.length > 0 ? (
                          <>
                            {locations.map((loc) => (
                              <th key={loc.id} className="py-2 px-3 text-center" title={loc.name}>
                                <div className="truncate max-w-[80px]">{loc.name.split(" ")[0]}</div>
                                <div className="text-[9px] text-gray-400 normal-case font-normal">{loc.type.replace("_", " ")}</div>
                              </th>
                            ))}
                            <th className="py-2 px-3 text-center">Total</th>
                          </>
                        ) : (
                          <th className="py-2 px-3">Stock</th>
                        )}
                        <th className="py-2 px-3">Available</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {variantRows.map((row, i) => {
                        const variantId = row.id || row.combination;
                        const vlStock = variantLocationStock[variantId] || {};
                        const totalLocStock = locations.length > 0
                          ? locations.reduce((sum, loc) => sum + (vlStock[loc.id] ?? 0), 0)
                          : 0;
                        return (
                          <tr key={row.combination}>
                            <td className="py-2 px-3 font-medium text-gray-800 text-xs">{row.combination}</td>
                            <td className="py-2 px-3">
                              <input type="text" value={row.sku || ""} onChange={(e) => updateVariantRow(i, "sku", e.target.value)} className="w-24 rounded border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none" />
                            </td>
                            <td className="py-2 px-3">
                              <input type="text" value={row.barcode || ""} onChange={(e) => updateVariantRow(i, "barcode", e.target.value)} placeholder="UPC, EAN..." className="w-28 rounded border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none" />
                            </td>
                            <td className="py-2 px-3">
                              <input type="number" min="0" step="0.01" value={row.price ?? ""} onChange={(e) => updateVariantRow(i, "price", e.target.value)} placeholder="Use default" className="w-28 rounded border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none" />
                            </td>
                            {locations.length > 0 ? (
                              <>
                                {locations.map((loc) => (
                                  <td key={loc.id} className="py-2 px-3">
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={vlStock[loc.id] ?? 0}
                                      onChange={(e) => {
                                        const val = Math.max(0, parseInt(e.target.value) || 0);
                                        setVariantLocationStock((prev) => ({
                                          ...prev,
                                          [variantId]: { ...(prev[variantId] || {}), [loc.id]: val },
                                        }));
                                        // Sync variant total stock to variantRow.stock
                                        const newTotal = locations.reduce(
                                          (sum, l) => sum + (l.id === loc.id ? val : (vlStock[l.id] ?? 0)),
                                          0
                                        );
                                        updateVariantRow(i, "stock", String(newTotal));
                                      }}
                                      className="w-16 rounded border border-gray-300 px-2 py-1 text-xs text-center focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                                    />
                                  </td>
                                ))}
                                <td className="py-2 px-3 text-center font-semibold text-gray-700 text-xs">
                                  {totalLocStock}
                                </td>
                              </>
                            ) : (
                              <td className="py-2 px-3">
                                <input type="number" min="0" step="1" value={row.stock ?? ""} onChange={(e) => updateVariantRow(i, "stock", e.target.value)} className="w-20 rounded border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none" />
                              </td>
                            )}
                            <td className="py-2 px-3">
                              <input type="checkbox" checked={row.available} onChange={(e) => updateVariantRow(i, "available", e.target.checked)} className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-300" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {locations.length > 0 && (
                      <tfoot className="bg-gray-50 border-t border-gray-200">
                        <tr>
                          <td colSpan={4} className="py-2 px-3 font-medium text-gray-900 text-xs">Total across all variants</td>
                          {locations.map((loc) => {
                            const locTotal = variantRows.reduce((sum, row) => {
                              const vid = row.id || row.combination;
                              return sum + ((variantLocationStock[vid] || {})[loc.id] ?? 0);
                            }, 0);
                            return (
                              <td key={loc.id} className="py-2 px-3 text-center font-semibold text-gray-700 text-xs">
                                {locTotal}
                              </td>
                            );
                          })}
                          <td className="py-2 px-3 text-center font-bold text-gray-900 text-xs">
                            {variantRows.reduce((sum, row) => {
                              const vid = row.id || row.combination;
                              return sum + locations.reduce((s, loc) => s + ((variantLocationStock[vid] || {})[loc.id] ?? 0), 0);
                            }, 0)}
                          </td>
                          <td className="py-2 px-3"></td>
                        </tr>
                      </tfoot>
                    )}
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
                  <label className="text-sm font-medium text-gray-700 block mb-1">SEO title</label>
                  <input type="text" value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none" />
                  <p className="text-xs text-gray-400 mt-1">{form.seoTitle.length}/70 characters</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Meta description</label>
                  <textarea rows={2} value={form.metaDescription} onChange={(e) => set("metaDescription", e.target.value.slice(0, 160))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none" />
                  <p className="text-xs text-gray-400 mt-1">{form.metaDescription.length}/160 characters</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">URL handle</label>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <span>shopora.com/products/</span>
                    <input type="text" value={form.urlHandle} onChange={(e) => set("urlHandle", slugify(e.target.value))} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none" />
                  </div>
                </div>

                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2">Search engine preview</p>
                  <p className="text-blue-700 text-base font-medium leading-tight">{seoPreviewTitle}</p>
                  <p className="text-green-700 text-xs mt-0.5">{seoPreviewUrl}</p>
                  <p className="text-gray-600 text-xs mt-1 line-clamp-2">{seoPreviewDesc}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ============ RIGHT COLUMN ============ */}
          <div className="lg:w-1/3 space-y-6">
            {/* --- Status --- */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Status</h2>
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Product organization</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Category <span className="text-red-500">*</span></label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => set("categoryId", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                  >
                    <option value="">Select a category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Subcategory</label>
                  <input type="text" value={form.subcategory} onChange={(e) => set("subcategory", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Product type</label>
                  <input type="text" value={form.productType} onChange={(e) => set("productType", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none" />
                </div>
                {form.tags.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Tags</label>
                    <div className="flex flex-wrap gap-1.5">
                      {form.tags.map((tag) => (
                        <span key={tag} className="bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5 text-xs font-medium">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* --- Publishing --- */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Publishing</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${form.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                    {form.status === "active" ? "Active" : "Draft"}
                  </span>
                </div>
                {createdAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Created</span>
                    <span className="text-gray-700">
                      {new Date(createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
                <div className="pt-2">
                  <Link
                    href={`/products/${productId}`}
                    target="_blank"
                    className="text-sm font-medium text-indigo-500 hover:text-indigo-700"
                  >
                    View on storefront →
                  </Link>
                </div>
              </div>
            </div>

            {/* --- Danger Zone --- */}
            <div className="bg-white rounded-xl border border-red-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-red-700 mb-2">
                Danger zone
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Permanently delete this product and all associated data. This
                action cannot be undone.
              </p>
              <button
                onClick={handleDelete}
                disabled={deleting || submitting}
                className="w-full rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition"
              >
                {deleting ? "Deleting..." : "Delete this product"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Toast Notification ---- */}
      {toast && (
        <div className="fixed top-6 right-6 z-[9999]">
          <div
            className={`flex items-center gap-3 rounded-lg border px-5 py-3.5 shadow-lg ${
              toast.type === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            <span className="text-lg">{toast.type === "success" ? "✓" : "✕"}</span>
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => { if (toastTimer.current) clearTimeout(toastTimer.current); setToast(null); }}
              className="ml-2 text-current opacity-50 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
