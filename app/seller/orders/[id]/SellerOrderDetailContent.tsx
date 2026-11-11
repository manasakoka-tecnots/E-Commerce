"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { supabase } from "@/src/lib/supabase/client";
import { getProductImageUrl } from "@/src/lib/catalog";
import Spinner from "@/src/components/Spinner";

/* ──────────────────────── Types ──────────────────────── */

type OrderDetail = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  updated_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  cancellation_reason: string | null;
  cancellation_details: string | null;
  cancelled_at: string | null;
  shipping_address: {
    full_name: string;
    phone: string;
    address_line1: string;
    address_line2: string | null;
    city: string;
    state: string;
    pincode: string;
  } | null;
};

type LineItem = {
  id: string; // order_item id
  product_name: string;
  product_id: string;
  sku: string;
  quantity: number;
  price: number;
  total: number;
  image_url: string | null;
};

type Fulfillment = {
  id: string;
  status: string;
  tracking_number: string | null;
  carrier: string | null;
  tracking_url: string | null;
  notes: string | null;
  created_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
  items: { order_item_id: string; quantity: number }[];
};

/* ──────────────────────── Constants ──────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-indigo-100 text-indigo-700",
  shipped: "bg-purple-100 text-purple-800",
  in_transit: "bg-indigo-100 text-indigo-700",
  out_for_delivery: "bg-orange-100 text-orange-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const FULFILLMENT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  shipped: "bg-blue-100 text-blue-800 border-blue-200",
  in_transit: "bg-indigo-100 text-indigo-800 border-indigo-200",
  out_for_delivery: "bg-orange-100 text-orange-800 border-orange-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

const FULFILLMENT_STATUS_TRANSITIONS: Record<string, { label: string; next: string }[]> = {
  pending: [{ label: "Mark Shipped", next: "shipped" }],
  shipped: [{ label: "In Transit", next: "in_transit" }],
  in_transit: [{ label: "Out for Delivery", next: "out_for_delivery" }],
  out_for_delivery: [{ label: "Mark Delivered", next: "delivered" }],
  delivered: [],
  cancelled: [],
};

const STATUS_TRANSITIONS: Record<string, { label: string; next: string }[]> = {
  pending: [
    { label: "Confirm Order", next: "confirmed" },
    { label: "Cancel Order", next: "cancelled" },
  ],
  confirmed: [
    { label: "Mark as Processing", next: "processing" },
    { label: "Cancel Order", next: "cancelled" },
  ],
  processing: [],
  shipped: [],
  delivered: [],
  cancelled: [],
};

const CARRIERS = [
  "India Post",
  "Blue Dart",
  "Delhivery",
  "DTDC",
  "Ekart",
  "Shadowfax",
  "Ecom Express",
  "Other",
];

const formatRupee = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/* ──────────────────────── Helpers ──────────────────────── */

async function getAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/* ──────────────────────── Component ──────────────────────── */

export default function SellerOrderDetailContent() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [fulfillments, setFulfillments] = useState<Fulfillment[]>([]);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Fulfillment creation state
  const [showFulfillForm, setShowFulfillForm] = useState(false);
  const [fulfillItems, setFulfillItems] = useState<Record<string, number>>({});
  const [fulfillCarrier, setFulfillCarrier] = useState(CARRIERS[0]);
  const [fulfillTracking, setFulfillTracking] = useState("");
  const [fulfillNotes, setFulfillNotes] = useState("");
  const [creatingFulfillment, setCreatingFulfillment] = useState(false);

  // Compute unfulfilled quantities per order_item
  const unfulfilledItems = useMemo(() => {
    const fulfilledQty: Record<string, number> = {};
    for (const f of fulfillments) {
      if (f.status === "cancelled") continue;
      for (const fi of f.items) {
        fulfilledQty[fi.order_item_id] = (fulfilledQty[fi.order_item_id] || 0) + fi.quantity;
      }
    }
    return lineItems
      .map((item) => ({
        ...item,
        fulfilled: fulfilledQty[item.id] || 0,
        unfulfilled: item.quantity - (fulfilledQty[item.id] || 0),
      }))
      .filter((item) => item.unfulfilled > 0);
  }, [lineItems, fulfillments]);

  const fulfillmentStatus = useMemo(() => {
    if (lineItems.length === 0) return "unfulfilled";
    const totalQty = lineItems.reduce((s, i) => s + i.quantity, 0);
    const activeFulfillments = fulfillments.filter((f) => f.status !== "cancelled");
    const fulfilledQty = activeFulfillments.reduce(
      (s, f) => s + f.items.reduce((s2, fi) => s2 + fi.quantity, 0),
      0
    );
    if (fulfilledQty === 0) return "unfulfilled";
    if (fulfilledQty >= totalQty) return "fulfilled";
    return "partially_fulfilled";
  }, [lineItems, fulfillments]);

  // Compute effective order status from fulfillments (like customer side does)
  // This ensures the badge shows the correct status even if DB is stale
  const effectiveStatus = useMemo(() => {
    if (!order) return "";
    const activeFulfillments = fulfillments.filter((f) => f.status !== "cancelled");
    if (activeFulfillments.length === 0) return order.status;

    const statusPriority = ["delivered", "out_for_delivery", "in_transit", "shipped", "pending"];
    const fulfillmentToOrder: Record<string, string> = {
      delivered: "delivered",
      out_for_delivery: "out_for_delivery",
      in_transit: "in_transit",
      shipped: "shipped",
      pending: "processing",
    };

    // Find the least advanced fulfillment status
    let lowestIdx = 0;
    for (const f of activeFulfillments) {
      const idx = statusPriority.indexOf(f.status);
      if (idx > lowestIdx) lowestIdx = idx;
    }

    const computed = fulfillmentToOrder[statusPriority[lowestIdx]] || order.status;

    // Only override if the computed status is MORE advanced than the DB status
    const orderPriority = ["pending", "confirmed", "processing", "shipped", "in_transit", "out_for_delivery", "delivered"];
    const dbIdx = orderPriority.indexOf(order.status);
    const computedIdx = orderPriority.indexOf(computed);
    if (computedIdx > dbIdx) return computed;
    return order.status;
  }, [order, fulfillments]);

  /* ──────────────── Load Order ──────────────── */

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setErrorMessage("Please sign in with your seller account.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("auth_uid", userData.user.id)
      .maybeSingle();

    if (!profile) {
      setErrorMessage("Could not load your account profile.");
      setLoading(false);
      return;
    }

    const { data: seller } = await supabase
      .from("sellers")
      .select("id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (!seller) {
      setErrorMessage("Seller account not found.");
      setLoading(false);
      return;
    }

    setSellerId(seller.id);

    // Get order
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select(`
        id, status, total_amount, created_at, updated_at, address_id,
        cancellation_reason, cancellation_details, cancelled_at,
        profiles!inner (full_name, email)
      `)
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !orderData) {
      setErrorMessage("Order not found.");
      setLoading(false);
      return;
    }

    const profileInfo = Array.isArray(orderData.profiles)
      ? orderData.profiles[0]
      : orderData.profiles;

    // Shipping address
    let shippingAddress: OrderDetail["shipping_address"] = null;
    if (orderData.address_id) {
      const { data: addrData } = await supabase
        .from("addresses")
        .select("label, line1, line2, city, state, pincode")
        .eq("id", orderData.address_id)
        .maybeSingle();

      if (addrData) {
        shippingAddress = {
          full_name: profileInfo?.full_name || "Customer",
          phone: "N/A",
          address_line1: addrData.line1 || "",
          address_line2: addrData.line2 || null,
          city: addrData.city || "",
          state: addrData.state || "",
          pincode: addrData.pincode || "",
        };
      }
    }

    // Get seller's listings
    const { data: listings } = await supabase
      .from("seller_listings")
      .select("id, product_id")
      .eq("seller_id", seller.id);

    const listingIds = (listings || []).map((l) => l.id);
    if (listingIds.length === 0) {
      setErrorMessage("You have no listings associated with this order.");
      setLoading(false);
      return;
    }

    // Get order items
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select(`
        id, seller_listing_id, quantity, price_at_purchase,
        seller_listings!inner (
          product_id,
          products (name, brand, product_images (storage_path, is_representative, "order"))
        )
      `)
      .eq("order_id", orderId)
      .in("seller_listing_id", listingIds);

    if (itemsError || !items || items.length === 0) {
      setErrorMessage("This order does not contain any of your products.");
      setLoading(false);
      return;
    }

    const orderDetail: OrderDetail = {
      id: orderData.id,
      status: orderData.status,
      total: Number(orderData.total_amount),
      created_at: orderData.created_at,
      updated_at: orderData.updated_at,
      customer_name: profileInfo?.full_name || "Unknown",
      customer_email: profileInfo?.email || "",
      customer_phone: shippingAddress?.phone || "N/A",
      cancellation_reason: (orderData as Record<string, unknown>).cancellation_reason as string | null ?? null,
      cancellation_details: (orderData as Record<string, unknown>).cancellation_details as string | null ?? null,
      cancelled_at: (orderData as Record<string, unknown>).cancelled_at as string | null ?? null,
      shipping_address: shippingAddress,
    };

    const parsedItems: LineItem[] = items.map((item) => {
      const listing = Array.isArray(item.seller_listings)
        ? item.seller_listings[0]
        : item.seller_listings;
      const product = listing?.products
        ? (Array.isArray(listing.products) ? listing.products[0] : listing.products)
        : null;
      const productId = listing?.product_id || "";
      const productImages = (product as Record<string, unknown>)?.product_images as Array<{
        storage_path: string;
        is_representative: boolean;
        order: number;
      }> | undefined;
      const sortedImages = [...(productImages ?? [])].sort(
        (a, b) =>
          (b.is_representative ? 1 : 0) - (a.is_representative ? 1 : 0) ||
          (a.order ?? 0) - (b.order ?? 0)
      );
      const imgPath = sortedImages[0]?.storage_path || null;
      const imageUrl = getProductImageUrl(imgPath);

      return {
        id: item.id,
        product_name: product?.name || "Product",
        product_id: productId,
        sku: productId.slice(0, 8).toUpperCase(),
        quantity: Number(item.quantity),
        price: Number(item.price_at_purchase),
        total: Number(item.price_at_purchase) * Number(item.quantity),
        image_url: imageUrl,
      };
    });

    // Load fulfillments for this order + seller
    const { data: fulfillmentData } = await supabase
      .from("fulfillments")
      .select(`
        id, status, tracking_number, carrier, tracking_url, notes,
        created_at, shipped_at, delivered_at,
        fulfillment_items (order_item_id, quantity)
      `)
      .eq("order_id", orderId)
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: true });

    const parsedFulfillments: Fulfillment[] = (fulfillmentData || []).map((f) => ({
      id: f.id,
      status: f.status,
      tracking_number: f.tracking_number,
      carrier: f.carrier,
      tracking_url: f.tracking_url,
      notes: f.notes,
      created_at: f.created_at,
      shipped_at: f.shipped_at,
      delivered_at: f.delivered_at,
      items: (f.fulfillment_items || []).map((fi: { order_item_id: string; quantity: number }) => ({
        order_item_id: fi.order_item_id,
        quantity: fi.quantity,
      })),
    }));

    setOrder(orderDetail);
    setLineItems(parsedItems);
    setFulfillments(parsedFulfillments);
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  // Auto-sync: if effective status differs from DB status, trigger a one-time background re-sync
  const hasSynced = useRef(false);
  useEffect(() => {
    if (!order || !effectiveStatus || effectiveStatus === order.status) return;
    if (hasSynced.current) return; // only sync once per page load
    if (fulfillments.filter((f) => f.status !== "cancelled").length === 0) return;

    const activeFulfillment = fulfillments.find((f) => f.status !== "cancelled");
    if (!activeFulfillment) return;

    hasSynced.current = true;
    (async () => {
      const token = await getAuthToken();
      if (!token) return;
      await fetch("/api/fulfillments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fulfillment_id: activeFulfillment.id,
          status: activeFulfillment.status,
        }),
      });
      void loadOrder();
    })();
  }, [order?.status, effectiveStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ──────────────── Actions ──────────────── */

  const handleStatusUpdate = async (newStatus: string) => {
    if (!order) return;
    setUpdatingStatus(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    // If cancelling, restore stock first
    if (newStatus === "cancelled") {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const stockRes = await fetch("/api/stock", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ action: "restore", order_id: order.id }),
        });

        if (!stockRes.ok) {
          const result = await stockRes.json();
          setErrorMessage(`Failed to restore stock: ${result.error}`);
          setUpdatingStatus(false);
          return;
        }
      } catch {
        setErrorMessage("Failed to restore stock. Please try again.");
        setUpdatingStatus(false);
        return;
      }
    }

    const token = await getAuthToken();
    if (!token) {
      setErrorMessage("Not authenticated");
      setUpdatingStatus(false);
      return;
    }

    const res = await fetch("/api/update-order-status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orderId: order.id, newStatus, sellerId }),
    });

    setUpdatingStatus(false);

    if (!res.ok) {
      const result = await res.json();
      setErrorMessage(`Failed to update status: ${result.error}`);
      return;
    }

    setOrder((prev) => (prev ? { ...prev, status: newStatus } : prev));
    setSuccessMessage(`Order status updated to "${newStatus}".${newStatus === "cancelled" ? " Stock has been restored." : ""}`);
  };

  const openFulfillForm = () => {
    const initial: Record<string, number> = {};
    for (const item of unfulfilledItems) {
      initial[item.id] = item.unfulfilled;
    }
    setFulfillItems(initial);
    setFulfillCarrier(CARRIERS[0]);
    setFulfillTracking("");
    setFulfillNotes("");
    setShowFulfillForm(true);
  };

  const handleCreateFulfillment = async () => {
    if (!order || !sellerId) return;

    const itemsToFulfill = Object.entries(fulfillItems)
      .filter(([, qty]) => qty > 0)
      .map(([order_item_id, quantity]) => ({ order_item_id, quantity }));

    if (itemsToFulfill.length === 0) {
      setErrorMessage("Select at least one item to fulfill.");
      return;
    }

    setCreatingFulfillment(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const token = await getAuthToken();
    if (!token) {
      setErrorMessage("Session expired. Please sign in again.");
      setCreatingFulfillment(false);
      return;
    }

    const resp = await fetch("/api/fulfillments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        order_id: order.id,
        seller_id: sellerId,
        items: itemsToFulfill,
        tracking_number: fulfillTracking.trim() || null,
        carrier: fulfillCarrier,
        notes: fulfillNotes.trim() || null,
      }),
    });

    const result = await resp.json();
    setCreatingFulfillment(false);

    if (!resp.ok || result.error) {
      setErrorMessage(result.error || "Failed to create fulfillment.");
      return;
    }

    setSuccessMessage("Fulfillment created successfully!");
    setShowFulfillForm(false);

    // Order status is synced server-side by syncOrderStatus in the fulfillments API
    void loadOrder();
  };

  const handleUpdateFulfillmentStatus = async (fulfillmentId: string, newStatus: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const token = await getAuthToken();
    if (!token) {
      setErrorMessage("Session expired.");
      return;
    }

    const resp = await fetch("/api/fulfillments", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fulfillment_id: fulfillmentId, status: newStatus }),
    });

    const result = await resp.json();
    if (!resp.ok || result.error) {
      setErrorMessage(result.error || "Failed to update fulfillment.");
      return;
    }

    setSuccessMessage(`Fulfillment status updated to "${newStatus}".`);

    // Order status is synced server-side in the fulfillments API
    void loadOrder();
  };

  const handleCancelFulfillment = async (fulfillmentId: string) => {
    if (!confirm("Cancel this fulfillment? Items will become unfulfilled.")) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const token = await getAuthToken();
    if (!token) {
      setErrorMessage("Session expired.");
      return;
    }

    const resp = await fetch(`/api/fulfillments?fulfillment_id=${fulfillmentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await resp.json();
    if (!resp.ok || result.error) {
      setErrorMessage(result.error || "Failed to cancel fulfillment.");
      return;
    }

    setSuccessMessage("Fulfillment cancelled.");
    void loadOrder();
  };

  /* ──────────────── Computed ──────────────── */

  const sellerSubtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const platformFee = 5;
  const orderTotal = sellerSubtotal + platformFee;
  const gstRate = 0.18;
  const taxableValue = Math.round(sellerSubtotal / (1 + gstRate));
  const gstAmount = sellerSubtotal - taxableValue;

  const transitions = order ? STATUS_TRANSITIONS[effectiveStatus] || [] : [];

  /* ──────────────── Render ──────────────── */

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 text-white border-b border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-lg font-black text-slate-950 shadow-md">
              S
            </span>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight">Order Details</h1>
              <p className="text-xs text-slate-400">Shopora Seller Central</p>
            </div>
          </div>
          <Link
            href="/seller/orders"
            className="rounded-lg border border-slate-600 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
          >
            Back to Orders
          </Link>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 flex-1">
        {loading ? (
          <div className="flex items-center justify-center p-16">
            <Spinner />
          </div>
        ) : errorMessage && !order ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center max-w-lg mx-auto space-y-3">
            <h2 className="text-sm font-bold text-red-800">Error</h2>
            <p className="text-xs text-red-600">{errorMessage}</p>
            <Link
              href="/seller/orders"
              className="inline-block rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition"
            >
              Back to Orders
            </Link>
          </div>
        ) : order ? (
          <div className="space-y-6">
            {/* Feedback */}
            {errorMessage && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700 flex justify-between items-center">
                <span>{errorMessage}</span>
                <button onClick={() => setErrorMessage(null)} className="font-bold">
                  x
                </button>
              </div>
            )}
            {successMessage && (
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-xs text-green-700 flex justify-between items-center">
                <span>{successMessage}</span>
                <button onClick={() => setSuccessMessage(null)} className="font-bold">
                  x
                </button>
              </div>
            )}

            {/* Order Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-black text-gray-900">
                    Order #{order.id.slice(0, 8).toUpperCase()}
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                      STATUS_COLORS[effectiveStatus] || "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {effectiveStatus.replace(/_/g, " ")}
                  </span>
                  <FulfillmentBadge status={fulfillmentStatus} />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Placed on {formatDateTime(order.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {transitions.map((t) => (
                  <button
                    key={t.next}
                    onClick={() => handleStatusUpdate(t.next)}
                    disabled={updatingStatus}
                    className={`rounded-lg px-4 py-2 text-xs font-bold transition disabled:opacity-50 ${
                      t.next === "cancelled"
                        ? "bg-red-100 text-red-700 hover:bg-red-200"
                        : "bg-indigo-600 text-white hover:bg-indigo-700"
                    }`}
                  >
                    {updatingStatus ? "..." : t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cancellation Info Banner */}
            {order.status === "cancelled" && order.cancellation_reason && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 space-y-2">
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <span className="text-sm font-bold text-red-700">Cancelled by Customer</span>
                  {order.cancelled_at && (
                    <span className="text-xs text-red-400 ml-auto">{formatDateTime(order.cancelled_at)}</span>
                  )}
                </div>
                <p className="text-sm text-red-600">
                  <span className="font-medium">Reason:</span> {order.cancellation_reason}
                </p>
                {order.cancellation_details && (
                  <p className="text-xs text-red-500 italic">&ldquo;{order.cancellation_details}&rdquo;</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-6">
                {/* ── Unfulfilled Items ── */}
                {unfulfilledItems.length > 0 && !showFulfillForm && (
                  <div className="rounded-xl border-2 border-dashed border-yellow-300 bg-yellow-50/50 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-yellow-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                        <h3 className="text-sm font-bold text-gray-900">
                          Unfulfilled ({unfulfilledItems.reduce((s, i) => s + i.unfulfilled, 0)})
                        </h3>
                      </div>
                      {effectiveStatus !== "cancelled" && effectiveStatus !== "delivered" && (
                        ["processing", "shipped", "in_transit", "out_for_delivery"].includes(effectiveStatus) ? (
                          <button
                            onClick={openFulfillForm}
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition"
                          >
                            Fulfill items
                          </button>
                        ) : (
                          <span className="text-[10px] text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full font-medium">
                            Mark as Processing first
                          </span>
                        )
                      )}
                    </div>
                    <div className="divide-y divide-yellow-100">
                      {unfulfilledItems.map((item) => (
                        <div key={item.id} className="px-6 py-3 flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {item.image_url ? (
                              <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-gray-300 text-lg">?</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-900 truncate">
                              {item.product_name}
                            </p>
                            <p className="text-[10px] text-gray-500">SKU: {item.sku}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-yellow-700">
                              {item.unfulfilled} of {item.quantity} unfulfilled
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Fulfill Items Form (Shopify-style) ── */}
                {showFulfillForm && (
                  <div className="rounded-xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-indigo-100 bg-indigo-50/50">
                      <h3 className="text-sm font-bold text-gray-900">Create fulfillment</h3>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        Select items and quantities to fulfill, then add tracking information.
                      </p>
                    </div>

                    {/* Item selection */}
                    <div className="divide-y divide-gray-100">
                      {unfulfilledItems.map((item) => (
                        <div key={item.id} className="px-6 py-3 flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {item.image_url ? (
                              <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-gray-300 text-lg">?</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-900 truncate">
                              {item.product_name}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {item.unfulfilled} available to fulfill
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setFulfillItems((prev) => ({
                                  ...prev,
                                  [item.id]: Math.max(0, (prev[item.id] || 0) - 1),
                                }))
                              }
                              className="h-7 w-7 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={0}
                              max={item.unfulfilled}
                              value={fulfillItems[item.id] || 0}
                              onChange={(e) => {
                                const val = Math.max(0, Math.min(item.unfulfilled, Number(e.target.value) || 0));
                                setFulfillItems((prev) => ({ ...prev, [item.id]: val }));
                              }}
                              className="w-12 text-center text-xs font-bold border border-gray-300 rounded py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setFulfillItems((prev) => ({
                                  ...prev,
                                  [item.id]: Math.min(item.unfulfilled, (prev[item.id] || 0) + 1),
                                }))
                              }
                              className="h-7 w-7 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Tracking info */}
                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/50 space-y-4">
                      <h4 className="text-xs font-bold text-gray-700">Tracking information</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                            Carrier
                          </label>
                          <select
                            value={fulfillCarrier}
                            onChange={(e) => setFulfillCarrier(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300/30"
                          >
                            {CARRIERS.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                            Tracking number
                          </label>
                          <input
                            type="text"
                            value={fulfillTracking}
                            onChange={(e) => setFulfillTracking(e.target.value)}
                            placeholder="e.g. DTDC123456789"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300/30"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                          Notes (optional)
                        </label>
                        <textarea
                          value={fulfillNotes}
                          onChange={(e) => setFulfillNotes(e.target.value)}
                          placeholder="Internal note about this shipment..."
                          rows={2}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300/30 resize-none"
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                      <button
                        onClick={() => setShowFulfillForm(false)}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateFulfillment}
                        disabled={
                          creatingFulfillment ||
                          Object.values(fulfillItems).every((v) => v === 0)
                        }
                        className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {creatingFulfillment ? "Creating..." : "Fulfill items"}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Existing Fulfillments ── */}
                {fulfillments
                  .filter((f) => f.status !== "cancelled")
                  .map((f, idx) => (
                    <FulfillmentCard
                      key={f.id}
                      fulfillment={f}
                      index={idx}
                      lineItems={lineItems}
                      onStatusUpdate={handleUpdateFulfillmentStatus}
                      onCancel={handleCancelFulfillment}
                    />
                  ))}

                {/* Cancelled fulfillments (collapsed) */}
                {fulfillments.filter((f) => f.status === "cancelled").length > 0 && (
                  <details className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <summary className="px-6 py-3 text-xs font-semibold text-gray-500 cursor-pointer hover:bg-gray-50">
                      Cancelled fulfillments ({fulfillments.filter((f) => f.status === "cancelled").length})
                    </summary>
                    {fulfillments
                      .filter((f) => f.status === "cancelled")
                      .map((f, idx) => (
                        <FulfillmentCard
                          key={f.id}
                          fulfillment={f}
                          index={idx}
                          lineItems={lineItems}
                          onStatusUpdate={handleUpdateFulfillmentStatus}
                          onCancel={handleCancelFulfillment}
                        />
                      ))}
                  </details>
                )}

                {/* ── All Items Table ── */}
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900">All Items</h3>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Only items from your store are shown
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold border-b border-gray-200">
                        <tr>
                          <th className="py-3 px-4">Product</th>
                          <th className="py-3 px-4">SKU</th>
                          <th className="py-3 px-4 text-center">Qty</th>
                          <th className="py-3 px-4 text-right">Price</th>
                          <th className="py-3 px-4 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {lineItems.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50/70 transition">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                  {item.image_url ? (
                                    <img
                                      src={item.image_url}
                                      alt={item.product_name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-gray-300 text-lg">?</span>
                                  )}
                                </div>
                                <span className="font-semibold text-gray-900">
                                  {item.product_name}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-gray-500 font-mono">{item.sku}</td>
                            <td className="py-3.5 px-4 text-center font-semibold text-gray-700">
                              {item.quantity}
                            </td>
                            <td className="py-3.5 px-4 text-right text-gray-700">
                              {formatRupee(item.price)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold text-gray-900">
                              {formatRupee(item.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Order Summary */}
                  <div className="border-t border-gray-200 px-6 py-4 bg-gray-50/50">
                    <div className="max-w-xs ml-auto space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Item Total (MRP)</span>
                        <span className="font-semibold text-gray-900">
                          {formatRupee(sellerSubtotal)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Shipping</span>
                        <span className="font-semibold text-indigo-500">Free</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Platform Fee</span>
                        <span className="font-semibold text-gray-700">
                          {formatRupee(platformFee)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-200">
                        <span className="font-bold text-gray-900">Order Total</span>
                        <span className="font-black text-gray-900">
                          {formatRupee(orderTotal)}
                        </span>
                      </div>
                      <div className="pt-1 text-[10px] text-gray-400 space-y-0.5">
                        <div className="flex justify-between">
                          <span>Taxable Value</span>
                          <span>{formatRupee(taxableValue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>GST (18%) — included in MRP</span>
                          <span>{formatRupee(gstAmount)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Sidebar */}
              <div className="space-y-6">
                {/* Customer Info */}
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
                  <h3 className="text-sm font-bold text-gray-900 mb-4">Customer</h3>
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="font-semibold text-gray-400 block">Name</span>
                      <p className="font-bold text-gray-900 mt-0.5">{order.customer_name}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-400 block">Email</span>
                      <p className="text-gray-700 mt-0.5">{order.customer_email}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-400 block">Phone</span>
                      <p className="text-gray-700 mt-0.5">{order.customer_phone}</p>
                    </div>
                  </div>
                </div>

                {/* Shipping Address */}
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
                  <h3 className="text-sm font-bold text-gray-900 mb-4">Shipping Address</h3>
                  {order.shipping_address ? (
                    <div className="text-xs text-gray-700 space-y-1">
                      <p className="font-bold text-gray-900">
                        {order.shipping_address.full_name}
                      </p>
                      <p>{order.shipping_address.address_line1}</p>
                      {order.shipping_address.address_line2 && (
                        <p>{order.shipping_address.address_line2}</p>
                      )}
                      <p>
                        {order.shipping_address.city}, {order.shipping_address.state}{" "}
                        {order.shipping_address.pincode}
                      </p>
                      <p className="text-gray-500 mt-2">
                        Phone: {order.shipping_address.phone}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">No shipping address on file</p>
                  )}
                </div>

                {/* Fulfillment Summary */}
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
                  <h3 className="text-sm font-bold text-gray-900 mb-4">Fulfillment Summary</h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total items</span>
                      <span className="font-bold">{lineItems.reduce((s, i) => s + i.quantity, 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Fulfilled</span>
                      <span className="font-bold text-green-600">
                        {lineItems.reduce((s, i) => s + i.quantity, 0) -
                          unfulfilledItems.reduce((s, i) => s + i.unfulfilled, 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Unfulfilled</span>
                      <span className="font-bold text-yellow-600">
                        {unfulfilledItems.reduce((s, i) => s + i.unfulfilled, 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Shipments</span>
                      <span className="font-bold">
                        {fulfillments.filter((f) => f.status !== "cancelled").length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

/* ──────────────────────── Sub-components ──────────────────────── */

function FulfillmentBadge({ status }: { status: string }) {
  if (status === "fulfilled") {
    return (
      <span className="rounded-full bg-green-100 text-green-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
        Fulfilled
      </span>
    );
  }
  if (status === "partially_fulfilled") {
    return (
      <span className="rounded-full bg-yellow-100 text-yellow-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
        Partially fulfilled
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-100 text-gray-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
      Unfulfilled
    </span>
  );
}

function FulfillmentCard({
  fulfillment,
  index,
  lineItems,
  onStatusUpdate,
  onCancel,
}: {
  fulfillment: Fulfillment;
  index: number;
  lineItems: LineItem[];
  onStatusUpdate: (id: string, status: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}) {
  const [updating, setUpdating] = useState(false);
  const transitions = FULFILLMENT_STATUS_TRANSITIONS[fulfillment.status] || [];
  const isCancelled = fulfillment.status === "cancelled";

  const getItemName = (orderItemId: string) => {
    const item = lineItems.find((li) => li.id === orderItemId);
    return item?.product_name || "Unknown item";
  };

  const getItemImage = (orderItemId: string) => {
    const item = lineItems.find((li) => li.id === orderItemId);
    return item?.image_url || null;
  };

  return (
    <div
      className={`rounded-xl border bg-white shadow-sm overflow-hidden ${
        isCancelled ? "border-red-200 opacity-60" : "border-green-200"
      }`}
    >
      <div
        className={`px-6 py-4 border-b flex items-center justify-between ${
          isCancelled ? "border-red-100 bg-red-50/30" : "border-green-100 bg-green-50/30"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`h-2.5 w-2.5 rounded-full ${
              isCancelled ? "bg-red-500" : "bg-green-500"
            }`}
          />
          <h3 className="text-sm font-bold text-gray-900">
            Fulfillment #{index + 1}
          </h3>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold border capitalize ${
              FULFILLMENT_STATUS_COLORS[fulfillment.status] || "bg-gray-100 text-gray-600 border-gray-200"
            }`}
          >
            {fulfillment.status.replace(/_/g, " ")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {transitions.map((t) => (
            <button
              key={t.next}
              onClick={async () => {
                setUpdating(true);
                await onStatusUpdate(fulfillment.id, t.next);
                setUpdating(false);
              }}
              disabled={updating}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {updating ? "..." : t.label}
            </button>
          ))}
          {!isCancelled && fulfillment.status !== "delivered" && (
            <button
              onClick={() => void onCancel(fulfillment.id)}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-[10px] font-bold text-red-600 hover:bg-red-50 transition"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Fulfillment items */}
      <div className="divide-y divide-gray-100">
        {fulfillment.items.map((fi) => (
          <div key={fi.order_item_id} className="px-6 py-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
              {getItemImage(fi.order_item_id) ? (
                <img src={getItemImage(fi.order_item_id)!} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-gray-300 text-sm">?</span>
              )}
            </div>
            <span className="text-xs text-gray-900 font-medium flex-1">
              {getItemName(fi.order_item_id)}
            </span>
            <span className="text-xs text-gray-500">x{fi.quantity}</span>
          </div>
        ))}
      </div>

      {/* Tracking info */}
      {(fulfillment.tracking_number || fulfillment.carrier) && (
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            {fulfillment.carrier && (
              <div>
                <span className="text-gray-400 font-semibold">Carrier: </span>
                <span className="text-gray-700 font-medium">{fulfillment.carrier}</span>
              </div>
            )}
            {fulfillment.tracking_number && (
              <div>
                <span className="text-gray-400 font-semibold">Tracking: </span>
                {fulfillment.tracking_url ? (
                  <a
                    href={fulfillment.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 font-medium hover:underline"
                  >
                    {fulfillment.tracking_number}
                  </a>
                ) : (
                  <span className="text-gray-700 font-medium font-mono">
                    {fulfillment.tracking_number}
                  </span>
                )}
              </div>
            )}
            {fulfillment.shipped_at && (
              <div>
                <span className="text-gray-400 font-semibold">Shipped: </span>
                <span className="text-gray-700">{formatDateTime(fulfillment.shipped_at)}</span>
              </div>
            )}
            {fulfillment.delivered_at && (
              <div>
                <span className="text-gray-400 font-semibold">Delivered: </span>
                <span className="text-gray-700">{formatDateTime(fulfillment.delivered_at)}</span>
              </div>
            )}
          </div>
          {fulfillment.notes && (
            <p className="text-[10px] text-gray-500 mt-2 italic">{fulfillment.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}
