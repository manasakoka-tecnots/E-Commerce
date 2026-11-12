"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/src/components/Navbar";
import { supabase } from "@/src/lib/supabase/client";
import Spinner from "@/src/components/Spinner";
import Footer from "@/src/components/Footer";
import Pagination, { usePagination } from "@/src/components/Pagination";

type OrderItem = {
  id: string;
  seller_listing_id: string;
  quantity: number;
  price_at_purchase: number;
  variant_title: string | null;
  seller_listings?: { product_id: string; products?: { name: string; brand: string | null } | null } | null;
};

type OrderFulfillment = {
  id: string;
  status: string;
  tracking_number: string | null;
  carrier: string | null;
  tracking_url: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
};

type Order = {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  order_items: OrderItem[];
  fulfillments: OrderFulfillment[];
};

type Address = {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
};

const formatRupee = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const ORDER_STEPS = [
  { key: "pending", label: "Order Placed", estDaysMin: 0, estDaysMax: 0 },
  { key: "confirmed", label: "Confirmed", estDaysMin: 0, estDaysMax: 1 },
  { key: "processing", label: "Processing", estDaysMin: 1, estDaysMax: 2 },
  { key: "shipped", label: "Shipped", estDaysMin: 2, estDaysMax: 4 },
  { key: "out_for_delivery", label: "Out for Delivery", estDaysMin: 4, estDaysMax: 6 },
  { key: "delivered", label: "Delivered", estDaysMin: 5, estDaysMax: 7 },
];

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function formatDateRange(d1: Date, d2: Date): string {
  const f1 = d1.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const f2 = d2.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  if (f1 === f2) return f1;
  // Same month → "5 - 7 Nov", different month → "29 Nov - 2 Dec"
  const m1 = d1.toLocaleDateString("en-IN", { month: "short" });
  const m2 = d2.toLocaleDateString("en-IN", { month: "short" });
  if (m1 === m2) return `${d1.getDate()} - ${d2.getDate()} ${m2}`;
  return `${f1} - ${f2}`;
}

function addDays(date: Date | string, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Map statuses (including fulfillment-specific ones) to ORDER_STEPS indices
function mapStatusToStepIndex(status: string): number {
  // in_transit sits between shipped and out_for_delivery — map to shipped step
  if (status === "in_transit") return ORDER_STEPS.findIndex(s => s.key === "shipped");
  return ORDER_STEPS.findIndex(s => s.key === status);
}

function getStepDate(
  stepKey: string,
  createdAt: string,
  fulfillments: OrderFulfillment[],
  orderStatus: string
): { text: string; isEstimate: boolean } | null {
  const latestFulfillment = fulfillments.length > 0
    ? fulfillments.reduce((latest, f) => {
        const ld = latest.shipped_at ? new Date(latest.shipped_at).getTime() : 0;
        const fd = f.shipped_at ? new Date(f.shipped_at).getTime() : 0;
        return fd > ld ? f : latest;
      })
    : null;

  const orderStepIndex = mapStatusToStepIndex(orderStatus);
  const step = ORDER_STEPS.find(s => s.key === stepKey)!;
  const thisStepIndex = ORDER_STEPS.indexOf(step);

  // For completed/current steps — show actual dates
  if (thisStepIndex <= orderStepIndex || orderStatus === "delivered") {
    switch (stepKey) {
      case "pending":
        return { text: formatDate(createdAt), isEstimate: false };
      case "confirmed":
        return { text: formatDate(createdAt), isEstimate: false };
      case "processing":
        return { text: formatDate(createdAt), isEstimate: false };
      case "shipped":
        if (latestFulfillment?.shipped_at) return { text: formatDate(latestFulfillment.shipped_at), isEstimate: false };
        return { text: formatDate(createdAt), isEstimate: false };
      case "out_for_delivery":
        if (latestFulfillment?.delivered_at) return { text: formatDate(latestFulfillment.delivered_at), isEstimate: false };
        if (latestFulfillment?.shipped_at) return { text: formatDate(latestFulfillment.shipped_at), isEstimate: false };
        return { text: formatDate(createdAt), isEstimate: false };
      case "delivered":
        if (latestFulfillment?.delivered_at) return { text: formatDate(latestFulfillment.delivered_at), isEstimate: false };
        return { text: formatDate(createdAt), isEstimate: false };
    }
  }

  // For future steps — show estimated date range (like Amazon/Flipkart)
  if (orderStatus !== "cancelled" && thisStepIndex > orderStepIndex) {
    const estMin = addDays(createdAt, step.estDaysMin);
    const estMax = addDays(createdAt, step.estDaysMax);
    return { text: formatDateRange(estMin, estMax), isEstimate: true };
  }

  return null;
}

function StepIcon({ state, stepKey }: { state: "completed" | "current" | "future" | "cancelled"; stepKey: string }) {
  if (state === "cancelled") {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <line x1="7" y1="7" x2="17" y2="17" />
        <line x1="17" y1="7" x2="7" y2="17" />
      </svg>
    );
  }
  if (state === "completed") {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <polyline points="6 12 10 16 18 8" />
      </svg>
    );
  }
  if (stepKey === "pending") {
    return (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="8" y="2" width="8" height="4" rx="1" />
        <rect x="4" y="4" width="16" height="18" rx="2" />
      </svg>
    );
  }
  if (stepKey === "confirmed") {
    return (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
        <polyline points="6 12 10 16 18 8" />
      </svg>
    );
  }
  if (stepKey === "processing") {
    return (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  if (stepKey === "shipped") {
    return (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="1" y="6" width="15" height="10" rx="1" />
        <polygon points="16 9 21 12 21 16 16 16" />
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </svg>
    );
  }
  if (stepKey === "out_for_delivery") {
    return (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 12L12 3l9 9" />
      <path d="M5 10v9a1 1 0 001 1h12a1 1 0 001-1v-9" />
    </svg>
  );
}

function OrderTimeline({ status, createdAt, fulfillments }: { status: string; createdAt: string; fulfillments: OrderFulfillment[] }) {
  const isCancelled = status === "cancelled";
  // Map fulfillment statuses to order step index
  const fulfillmentStatus = fulfillments.length > 0
    ? fulfillments.reduce((best, f) => {
        const idx = mapStatusToStepIndex(f.status);
        return idx > best ? idx : best;
      }, -1)
    : -1;
  const orderStepIndex = mapStatusToStepIndex(status);
  const currentIndex = Math.max(orderStepIndex, fulfillmentStatus);

  function getStepState(index: number): "completed" | "current" | "future" | "cancelled" {
    if (isCancelled) {
      return index === 0 ? "completed" : index === 1 ? "cancelled" : "future";
    }
    if (currentIndex < 0) return "future";
    if (status === "delivered") return "completed";
    if (index < currentIndex) return "completed";
    if (index === currentIndex) return "current";
    return "future";
  }

  const stateColors = {
    completed: "bg-teal-500 border-teal-500 text-white",
    current: "bg-teal-500 border-teal-500 text-white",
    cancelled: "bg-red-500 border-red-500 text-white",
    future: "bg-white border-slate-300 text-slate-400",
  };

  const labelColors = {
    completed: "text-teal-700",
    current: "text-teal-700",
    cancelled: "text-red-600",
    future: "text-slate-400",
  };

  return (
    <div className="pt-4 pb-2">
      {/* Desktop: horizontal */}
      <div className="hidden sm:flex items-start justify-between relative">
        {ORDER_STEPS.map((step, i) => {
          const state = getStepState(i);
          return (
            <div key={step.key} className="flex-1 flex flex-col items-center relative">
              {i > 0 && (
                <div
                  className={`absolute top-3 h-0.5 -z-0 ${
                    state === "completed" || state === "current"
                      ? "bg-teal-400"
                      : state === "cancelled"
                      ? "bg-red-300"
                      : "border-t-2 border-dashed border-slate-300 bg-transparent"
                  }`}
                  style={{ left: "-50%", right: "50%" }}
                />
              )}
              <div
                className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all ${stateColors[state]} ${
                  state === "current" ? "ring-4 ring-teal-100" : ""
                }`}
              >
                <StepIcon state={state} stepKey={step.key} />
              </div>
              <p className={`mt-1.5 text-[11px] font-bold text-center ${labelColors[state]}`}>
                {state === "cancelled" ? "Cancelled" : step.label}
              </p>
              {(() => {
                const dateInfo = getStepDate(step.key, createdAt, fulfillments, status);
                if (!dateInfo) return <p className="text-[10px] text-slate-400 mt-0.5">&nbsp;</p>;
                return dateInfo.isEstimate ? (
                  <p className="text-[10px] text-slate-400 mt-0.5 italic">Est. {dateInfo.text}</p>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-0.5">{dateInfo.text}</p>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Mobile: vertical */}
      <div className="sm:hidden space-y-0">
        {ORDER_STEPS.map((step, i) => {
          const state = getStepState(i);
          const isLast = i === ORDER_STEPS.length - 1;
          return (
            <div key={step.key} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`flex items-center justify-center w-6 h-6 rounded-full border-2 shrink-0 ${stateColors[state]} ${
                    state === "current" ? "ring-4 ring-teal-100" : ""
                  }`}
                >
                  <StepIcon state={state} stepKey={step.key} />
                </div>
                {!isLast && (
                  <div
                    className={`w-0.5 h-7 ${
                      getStepState(i + 1) === "completed" || getStepState(i + 1) === "current"
                        ? "bg-teal-400"
                        : getStepState(i + 1) === "cancelled"
                        ? "bg-red-300"
                        : "border-l-2 border-dashed border-slate-300"
                    }`}
                  />
                )}
              </div>
              <div className="pt-0.5 pb-2">
                <p className={`text-xs font-bold ${labelColors[state]}`}>
                  {state === "cancelled" ? "Cancelled" : step.label}
                </p>
                {(() => {
                  const dateInfo = getStepDate(step.key, createdAt, fulfillments, status);
                  if (!dateInfo) return <p className="text-[10px] text-slate-400">&nbsp;</p>;
                  return dateInfo.isEstimate ? (
                    <p className="text-[10px] text-slate-400 italic">Est. {dateInfo.text}</p>
                  ) : (
                    <p className="text-[10px] text-slate-400">{dateInfo.text}</p>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Derive effective order status from fulfillments (since order.status sync may fail due to RLS)
function getEffectiveStatus(order: Order): string {
  if (order.status === "cancelled" || order.status === "delivered") return order.status;
  const activeFulfillments = order.fulfillments.filter(f => f.status !== "cancelled");
  if (activeFulfillments.length === 0) return order.status;

  const statusPriority = ["delivered", "out_for_delivery", "in_transit", "shipped", "pending"];
  // Find the least-advanced fulfillment
  let lowestIdx = 0;
  for (const f of activeFulfillments) {
    const idx = statusPriority.indexOf(f.status);
    if (idx > lowestIdx) lowestIdx = idx;
  }
  const fulfillmentToOrder: Record<string, string> = {
    delivered: "delivered",
    out_for_delivery: "out_for_delivery",
    in_transit: "in_transit",
    shipped: "shipped",
    pending: "processing",
  };
  const fulfillmentStatus = fulfillmentToOrder[statusPriority[lowestIdx]] || order.status;

  // Use whichever is more advanced: order.status or fulfillment-derived status
  const orderIdx = statusPriority.indexOf(order.status);
  const fulIdx = statusPriority.indexOf(fulfillmentStatus);
  // Lower index = more advanced
  if (fulIdx >= 0 && (orderIdx < 0 || fulIdx < orderIdx)) return fulfillmentStatus;
  return order.status;
}

export default function DashboardContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ id: string; email: string; full_name: string | null; role: string } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [activeTab, setActiveTab] = useState<"orders" | "addresses" | "profile">("orders");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const ORDERS_PER_PAGE = 8;
  const { currentPage: ordersPage, setCurrentPage: setOrdersPage, paginatedItems: paginatedOrders } = usePagination(orders, ORDERS_PER_PAGE);

  // Cancel order state
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelDetails, setCancelDetails] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);

  // Address form state
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [editAddrId, setEditAddrId] = useState<string | null>(null);
  const [addrLabel, setAddrLabel] = useState("Home");
  const [addrLine1, setAddrLine1] = useState("");
  const [addrLine2, setAddrLine2] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrPincode, setAddrPincode] = useState("");
  const [addrSaving, setAddrSaving] = useState(false);
  const [addrError, setAddrError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login?redirect=/dashboard");
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("id, email, full_name, role")
        .eq("auth_uid", user.id)
        .maybeSingle();

      if (!active) return;
      setProfile(prof ?? { id: "", email: user.email || "", full_name: null, role: "customer" });

      if (prof?.id) {
        const { data: ordersData } = await supabase
          .from("orders")
          .select("id, created_at, total_amount, status, order_items(id, seller_listing_id, quantity, price_at_purchase, variant_title, seller_listings(product_id, products(name, brand))), fulfillments(id, status, tracking_number, carrier, tracking_url, shipped_at, delivered_at)")
          .eq("profile_id", prof.id)
          .order("created_at", { ascending: false });

        if (active && ordersData) {
          const normalizedOrders: Order[] = ordersData.map((order) => ({
            id: order.id,
            created_at: order.created_at,
            total_amount: Number(order.total_amount) || 0,
            status: order.status,
            order_items: (order.order_items ?? []).map((item: Record<string, unknown>) => {
              const sellerListings = item.seller_listings as Record<string, unknown> | Record<string, unknown>[] | null;
              const listing = Array.isArray(sellerListings) ? sellerListings[0] : sellerListings;
              const products = listing?.products as { name: string; brand: string | null } | { name: string; brand: string | null }[] | null;
              const product = Array.isArray(products) ? products[0] : products;
              return {
                id: item.id as string,
                seller_listing_id: item.seller_listing_id as string,
                quantity: item.quantity as number,
                price_at_purchase: Number(item.price_at_purchase) || 0,
                variant_title: (item.variant_title as string) || null,
                seller_listings: listing ? { product_id: listing.product_id as string, products: product ?? null } : null,
              };
            }),
            fulfillments: ((order as Record<string, unknown>).fulfillments as OrderFulfillment[] ?? []).filter(
              (f: OrderFulfillment) => f.status !== "cancelled"
            ),
          }));

          setOrders(normalizedOrders);
        }

        const { data: addressData } = await supabase
          .from("addresses")
          .select("id, label, line1, line2, city, state, pincode")
          .eq("profile_id", prof.id)
          .order("created_at", { ascending: false });

        if (active && addressData) {
          setAddresses(addressData);
        }
      }

      if (active) setLoading(false);
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [router]);

  const INDIAN_STATES = [
    "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana",
    "Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur",
    "Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
    "Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
    "Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi",
    "Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"
  ];

  const resetAddrForm = () => {
    setAddrLabel("Home"); setAddrLine1(""); setAddrLine2(""); setAddrCity(""); setAddrState(""); setAddrPincode("");
    setEditAddrId(null); setShowAddrForm(false); setAddrError(null);
  };

  const startEditAddr = (addr: Address) => {
    setAddrLabel(addr.label); setAddrLine1(addr.line1); setAddrLine2(addr.line2 || "");
    setAddrCity(addr.city); setAddrState(addr.state); setAddrPincode(addr.pincode);
    setEditAddrId(addr.id); setShowAddrForm(true); setAddrError(null);
  };

  const deleteAddr = async (id: string) => {
    const { error: delErr } = await supabase.from("addresses").delete().eq("id", id);
    if (delErr) { setAddrError(delErr.message); return; }
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  };

  const saveAddr = async () => {
    if (!profile?.id || !addrLine1 || !addrCity || !addrState || !addrPincode) {
      setAddrError("Please fill in all required fields."); return;
    }
    setAddrSaving(true); setAddrError(null);
    if (editAddrId) {
      const { data, error: err } = await supabase.from("addresses")
        .update({ label: addrLabel || "Home", line1: addrLine1, line2: addrLine2 || null, city: addrCity, state: addrState, pincode: addrPincode })
        .eq("id", editAddrId).select().single();
      setAddrSaving(false);
      if (err) { setAddrError(err.message); return; }
      setAddresses((prev) => prev.map((a) => a.id === editAddrId ? (data as Address) : a));
    } else {
      const { data, error: err } = await supabase.from("addresses")
        .insert({ profile_id: profile.id, label: addrLabel || "Home", line1: addrLine1, line2: addrLine2 || null, city: addrCity, state: addrState, pincode: addrPincode, country: "India" })
        .select().single();
      setAddrSaving(false);
      if (err) { setAddrError(err.message); return; }
      setAddresses((prev) => [data as Address, ...prev]);
    }
    resetAddrForm();
  };

  const CANCELLABLE_STATUSES = ["pending", "confirmed", "processing"];
  const CANCEL_REASONS = [
    "Changed my mind",
    "Found a better price elsewhere",
    "Ordered by mistake",
    "Delivery time is too long",
    "Want to change address/payment",
    "Duplicate order",
    "Other",
  ];

  const handleCancelOrder = async () => {
    if (!cancelOrderId || !cancelReason) return;
    setCancelLoading(true);
    setCancelError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/cancel-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          order_id: cancelOrderId,
          reason: cancelReason,
          reason_details: cancelDetails || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCancelError(data.error || "Failed to cancel order");
        setCancelLoading(false);
        return;
      }
      // Update order in local state
      setOrders(prev => prev.map(o => o.id === cancelOrderId ? { ...o, status: "cancelled" } : o));
      setCancelSuccess(data.message || "Order cancelled successfully.");
      setTimeout(() => {
        setCancelOrderId(null);
        setCancelReason("");
        setCancelDetails("");
        setCancelSuccess(null);
      }, 3000);
    } catch (err) {
      setCancelError(String(err));
    }
    setCancelLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f5f5f6]">
        <Navbar />
        <div className="flex flex-1 items-center justify-center p-12">
          <Spinner />
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "orders" as const, label: "Orders", count: orders.length },
    { key: "addresses" as const, label: "Addresses", count: addresses.length },
    { key: "profile" as const, label: "Profile" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f6] text-slate-900">
      <Navbar />

      <main className="mx-auto w-full max-w-[1100px] px-4 py-5 flex-1">
        {/* Profile Header */}
        <div className="bg-white px-5 py-5 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center bg-[#ff3f6c] text-xl font-black text-white">
              {(profile?.full_name || profile?.email || "U")[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                {profile?.full_name || "Valued Customer"}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">{profile?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/products"
              className="bg-[#ff3f6c] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-[#e5355f]"
            >
              Shop Now
            </Link>
            <button
              onClick={handleSignOut}
              className="border border-slate-300 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 transition hover:border-[#ff3f6c] hover:text-[#ff3f6c]"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Tab Navigation — Myntra style */}
        <div className="bg-white mb-4">
          <div className="flex border-b border-slate-200">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-3.5 text-center text-sm font-bold uppercase tracking-wider transition border-b-2 ${
                  activeTab === tab.key
                    ? "border-[#ff3f6c] text-[#ff3f6c]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="ml-1.5 text-xs font-normal">({tab.count})</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab 1: Orders */}
        {activeTab === "orders" && (
          <section>
            {orders.length === 0 ? (
              <div className="bg-white p-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center">
                  <svg className="h-12 w-12 text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={0.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-slate-800">No orders placed yet</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Explore the products currently available in the marketplace.
                </p>
                <Link
                  href="/products"
                  className="mt-5 inline-block border-2 border-[#ff3f6c] px-10 py-3 text-sm font-bold uppercase tracking-wider text-[#ff3f6c] transition hover:bg-[#ff3f6c] hover:text-white"
                >
                  Browse Catalog
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {paginatedOrders.map((order) => {
                  const isExpanded = expandedOrderId === order.id;
                  const effectiveStatus = getEffectiveStatus(order);
                  return (
                    <div key={order.id} className="bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        className="w-full text-left px-5 py-4 hover:bg-slate-50/50 transition-colors"
                      >
                        {/* Order header row */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 text-xs">
                          <div className="flex items-center gap-3">
                            <span className="text-slate-400">Order #</span>
                            <span className="font-mono font-bold text-slate-700">{order.id.slice(0, 8).toUpperCase()}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-500">
                              {new Date(order.created_at).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 font-bold uppercase text-[10px] ${
                                effectiveStatus === "cancelled"
                                  ? "bg-red-50 text-red-600"
                                  : effectiveStatus === "delivered"
                                  ? "bg-teal-50 text-teal-700"
                                  : effectiveStatus === "out_for_delivery"
                                  ? "bg-amber-50 text-amber-700"
                                  : effectiveStatus === "in_transit"
                                  ? "bg-indigo-50 text-indigo-600"
                                  : effectiveStatus === "shipped"
                                  ? "bg-blue-50 text-blue-600"
                                  : "bg-orange-50 text-orange-600"
                              }`}
                            >
                              {effectiveStatus === "out_for_delivery" ? "OUT FOR DELIVERY" : effectiveStatus === "in_transit" ? "IN TRANSIT" : effectiveStatus}
                            </span>
                            <svg
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            >
                              <path
                                fillRule="evenodd"
                                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                        </div>

                        {/* Expected delivery summary */}
                        {effectiveStatus !== "delivered" && effectiveStatus !== "cancelled" && (() => {
                          const deliveryStep = ORDER_STEPS.find(s => s.key === "delivered")!;
                          const estMax = addDays(order.created_at, deliveryStep.estDaysMax);
                          const estDateStr = estMax.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
                          return (
                            <div className="mt-2 flex items-center gap-1.5 text-xs">
                              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" strokeWidth={2}>
                                <rect x="1" y="6" width="15" height="10" rx="1" />
                                <polygon points="16 9 21 12 21 16 16 16" />
                                <circle cx="6" cy="18" r="2" />
                                <circle cx="18" cy="18" r="2" />
                              </svg>
                              <span className="text-teal-700 font-bold">Arriving by {estDateStr}</span>
                            </div>
                          );
                        })()}

                        {/* Order items */}
                        <div className="mt-3 space-y-2">
                          {order.order_items?.map((item) => (
                            <div key={item.id} className="flex justify-between items-center text-sm">
                              <div>
                                <p className="font-bold text-slate-800">
                                  {item.seller_listings?.products?.name || "Product"}
                                </p>
                                {item.variant_title && (
                                <p className="text-xs text-indigo-500 font-medium">
                                  {item.variant_title}
                                </p>
                                )}
                                {item.seller_listings?.products?.brand && (
                                <p className="text-xs text-slate-400">
                                  {item.seller_listings?.products?.brand}
                                </p>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="text-xs text-slate-400">Qty: {item.quantity} &times; </span>
                                <span className="font-bold text-slate-900">
                                  {formatRupee(item.price_at_purchase)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="pt-3 mt-3 border-t border-dashed border-slate-200 flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-500 uppercase">Total Amount</span>
                          <span className="text-base font-bold text-slate-900">
                            {formatRupee(order.total_amount)}
                          </span>
                        </div>
                      </button>

                      {/* Expanded: Order Timeline + Tracking */}
                      {isExpanded && (
                        <div className="px-5 pb-5 border-t border-slate-100">
                          <OrderTimeline status={effectiveStatus} createdAt={order.created_at} fulfillments={order.fulfillments} />

                          {/* Cancel Order Button — only for pre-shipping statuses */}
                          {CANCELLABLE_STATUSES.includes(effectiveStatus) && (
                            <div className="mt-4 flex items-center gap-3">
                              <button
                                onClick={() => { setCancelOrderId(order.id); setCancelError(null); setCancelSuccess(null); setCancelReason(""); setCancelDetails(""); }}
                                className="border-2 border-red-400 text-red-500 px-5 py-2 text-xs font-bold uppercase tracking-wider hover:bg-red-50 transition"
                              >
                                Cancel Order
                              </button>
                              <span className="text-[11px] text-slate-400">
                                You can cancel this order until it is shipped
                              </span>
                            </div>
                          )}
                          {effectiveStatus === "cancelled" && (
                            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                              <p className="text-sm font-bold text-red-600">Order Cancelled</p>
                              <p className="text-xs text-red-500 mt-1">Refund will be processed within 5-7 business days to your original payment method.</p>
                            </div>
                          )}

                          {/* Tracking Information */}
                          {order.fulfillments.length > 0 && (
                            <div className="mt-4 space-y-2">
                              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Shipment Tracking
                              </p>
                              {order.fulfillments.map((f, idx) => (
                                <div
                                  key={f.id}
                                  className="flex flex-wrap items-center gap-3 bg-slate-50 rounded-lg px-4 py-3 text-xs"
                                >
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                    f.status === "delivered"
                                      ? "bg-teal-100 text-teal-700"
                                      : f.status === "shipped" || f.status === "in_transit"
                                      ? "bg-blue-100 text-blue-700"
                                      : f.status === "out_for_delivery"
                                      ? "bg-orange-100 text-orange-700"
                                      : "bg-slate-200 text-slate-600"
                                  }`}>
                                    {order.fulfillments.length > 1 ? `Shipment ${idx + 1}: ` : ""}
                                    {f.status.replace(/_/g, " ")}
                                  </span>
                                  {f.carrier && (
                                    <span className="text-slate-500">
                                      {f.carrier}
                                    </span>
                                  )}
                                  {f.tracking_number && (
                                    f.tracking_url ? (
                                      <a
                                        href={f.tracking_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-mono font-bold text-[#ff3f6c] hover:underline"
                                      >
                                        {f.tracking_number}
                                      </a>
                                    ) : (
                                      <span className="font-mono font-bold text-slate-700">
                                        {f.tracking_number}
                                      </span>
                                    )
                                  )}
                                  {f.shipped_at && (
                                    <span className="text-slate-400">
                                      Shipped {new Date(f.shipped_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                    </span>
                                  )}
                                  {f.delivered_at && (
                                    <span className="text-teal-600 font-bold">
                                      Delivered {new Date(f.delivered_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <Pagination
                  currentPage={ordersPage}
                  totalItems={orders.length}
                  itemsPerPage={ORDERS_PER_PAGE}
                  onPageChange={setOrdersPage}
                  itemLabel="orders"
                />
              </div>
            )}
          </section>
        )}

        {/* Tab 2: Addresses */}
        {activeTab === "addresses" && (
          <section className="space-y-3">
            <div className="bg-white px-5 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Manage Addresses</h3>
              {!showAddrForm && (
                <button onClick={() => { resetAddrForm(); setShowAddrForm(true); }}
                  className="bg-[#ff3f6c] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-[#e5355f]">
                  + Add New
                </button>
              )}
            </div>

            {addrError && (
              <div className="bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-600">{addrError}</p>
              </div>
            )}

            {showAddrForm && (
              <div className="bg-white p-5 space-y-4">
                <p className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  {editAddrId ? "Edit Address" : "Add New Address"}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <input value={addrLabel} onChange={(e) => setAddrLabel(e.target.value)} placeholder="Label (Home / Work / Other)"
                      className="w-full border-b-2 border-slate-200 bg-transparent px-0 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ff3f6c] transition" />
                  </div>
                  <div className="sm:col-span-2">
                    <input value={addrLine1} onChange={(e) => setAddrLine1(e.target.value)} placeholder="Street / Flat / Building *"
                      className="w-full border-b-2 border-slate-200 bg-transparent px-0 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ff3f6c] transition" />
                  </div>
                  <div className="sm:col-span-2">
                    <input value={addrLine2} onChange={(e) => setAddrLine2(e.target.value)} placeholder="Area / Landmark (optional)"
                      className="w-full border-b-2 border-slate-200 bg-transparent px-0 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ff3f6c] transition" />
                  </div>
                  <div>
                    <input value={addrCity} onChange={(e) => setAddrCity(e.target.value)} placeholder="City *"
                      className="w-full border-b-2 border-slate-200 bg-transparent px-0 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ff3f6c] transition" />
                  </div>
                  <div>
                    <select value={addrState} onChange={(e) => setAddrState(e.target.value)}
                      className="w-full border-b-2 border-slate-200 bg-transparent px-0 py-3 text-sm text-slate-900 focus:outline-none focus:border-[#ff3f6c] transition">
                      <option value="">Select State *</option>
                      {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <input value={addrPincode} onChange={(e) => setAddrPincode(e.target.value)} placeholder="PIN Code *"
                      className="w-full border-b-2 border-slate-200 bg-transparent px-0 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ff3f6c] transition" />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => void saveAddr()} disabled={addrSaving}
                    className="bg-[#ff3f6c] px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-[#e5355f] disabled:opacity-50 disabled:cursor-not-allowed">
                    {addrSaving ? "Saving..." : editAddrId ? "Update" : "Save Address"}
                  </button>
                  <button onClick={resetAddrForm}
                    className="border border-slate-300 px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-700 transition hover:border-[#ff3f6c] hover:text-[#ff3f6c]">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {addresses.length === 0 && !showAddrForm ? (
              <div className="bg-white p-12 text-center">
                <svg className="mx-auto h-12 w-12 text-slate-200 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <h3 className="text-base font-bold text-slate-800">No saved addresses</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Add an address to speed up your checkout experience.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {addresses.map((addr) => (
                  <div key={addr.id} className="bg-white p-5 space-y-2">
                    <div className="flex items-start justify-between">
                      <span className="bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        {addr.label}
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => startEditAddr(addr)}
                          className="text-xs font-bold text-[#ff3f6c] hover:underline transition">
                          EDIT
                        </button>
                        <button onClick={() => void deleteAddr(addr.id)}
                          className="text-xs font-bold text-slate-500 hover:text-red-500 transition">
                          REMOVE
                        </button>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-slate-800">{addr.line1}</p>
                    {addr.line2 && <p className="text-sm text-slate-500">{addr.line2}</p>}
                    <p className="text-sm text-slate-500">
                      {addr.city}, {addr.state} — {addr.pincode}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab 3: Account Info */}
        {activeTab === "profile" && (
          <section className="bg-white p-6 max-w-xl space-y-5">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Profile Details</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block uppercase tracking-wider">Full Name</label>
                <p className="text-sm font-bold text-slate-800 mt-1">{profile?.full_name || "Not set"}</p>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <label className="text-xs text-slate-400 block uppercase tracking-wider">Email Address</label>
                <p className="text-sm font-bold text-slate-800 mt-1">{profile?.email}</p>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <label className="text-xs text-slate-400 block uppercase tracking-wider">Account Type</label>
                <p className="text-sm font-bold text-slate-800 mt-1 capitalize">{profile?.role || "Customer"}</p>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Cancel Order Modal */}
      {cancelOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !cancelLoading && setCancelOrderId(null)}>
          <div className="bg-white w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            {cancelSuccess ? (
              <div className="p-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-100">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <polyline points="6 12 10 16 18 8" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Order Cancelled</h3>
                <p className="text-sm text-slate-500 mt-2">{cancelSuccess}</p>
              </div>
            ) : (
              <>
                <div className="px-6 py-5 border-b border-slate-200">
                  <h3 className="text-base font-bold text-slate-900">Cancel Order</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Order #{cancelOrderId.slice(0, 8).toUpperCase()} — Are you sure you want to cancel?
                  </p>
                </div>

                <div className="px-6 py-5 space-y-4">
                  {cancelError && (
                    <div className="bg-red-50 border border-red-200 px-4 py-3 rounded">
                      <p className="text-sm text-red-600">{cancelError}</p>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                      Why are you cancelling? <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      {CANCEL_REASONS.map(reason => (
                        <div key={reason} onClick={() => setCancelReason(reason)} className="flex items-center gap-3 cursor-pointer group">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition ${
                            cancelReason === reason ? "border-[#ff3f6c] bg-[#ff3f6c]" : "border-slate-300 group-hover:border-slate-400"
                          }`}>
                            {cancelReason === reason && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <span className="text-sm text-slate-700">{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {cancelReason === "Other" && (
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                        Please tell us more
                      </label>
                      <textarea
                        value={cancelDetails}
                        onChange={e => setCancelDetails(e.target.value)}
                        placeholder="Describe your reason..."
                        rows={3}
                        className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ff3f6c] transition resize-none"
                      />
                    </div>
                  )}

                  <div className="bg-amber-50 border border-amber-200 rounded px-4 py-3">
                    <p className="text-xs text-amber-700">
                      <span className="font-bold">Note:</span> Once cancelled, this action cannot be undone. Refund will be processed within 5-7 business days to your original payment method.
                    </p>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                  <button
                    onClick={() => setCancelOrderId(null)}
                    disabled={cancelLoading}
                    className="border border-slate-300 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 transition hover:border-slate-400 disabled:opacity-50"
                  >
                    Keep Order
                  </button>
                  <button
                    onClick={() => void handleCancelOrder()}
                    disabled={cancelLoading || !cancelReason}
                    className="bg-red-500 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cancelLoading ? "Cancelling..." : "Yes, Cancel Order"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
