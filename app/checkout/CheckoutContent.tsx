"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/src/components/Navbar";
import Footer from "@/src/components/Footer";
import { useCart } from "@/src/context/CartContext";
import { supabase } from "@/src/lib/supabase/client";

const formatRupee = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

type Profile = { id: string; full_name: string | null };
type Address = { id: string; label: string; line1: string; line2: string | null; city: string; state: string; pincode: string };

export default function CheckoutContent() {
  const router = useRouter();
  const { items, totalAmount, clear } = useCart();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [authLoading, setAuthLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [orderDone, setOrderDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Address form state
  const [newLine1, setNewLine1] = useState("");
  const [newLine2, setNewLine2] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newState, setNewState] = useState("");
  const [newPincode, setNewPincode] = useState("");
  const [newLabel, setNewLabel] = useState("Home");
  const [addingAddress, setAddingAddress] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login?redirect=/checkout");
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("auth_uid", user.id)
        .maybeSingle();
      setProfile(prof);

      if (prof?.id) {
        const { data: addrs } = await supabase
          .from("addresses")
          .select("id, label, line1, line2, city, state, pincode")
          .eq("profile_id", prof.id)
          .order("created_at");
        setAddresses(addrs ?? []);
        if (addrs && addrs.length > 0) setSelectedAddressId(addrs[0].id);
      }
      setAuthLoading(false);
    };
    void checkAuth();
  }, [router]);

  const resetForm = () => {
    setNewLabel("Home"); setNewLine1(""); setNewLine2(""); setNewCity(""); setNewState(""); setNewPincode("");
    setEditingAddressId(null); setShowAddressForm(false);
  };

  const startEditAddress = (addr: Address) => {
    setNewLabel(addr.label); setNewLine1(addr.line1); setNewLine2(addr.line2 || "");
    setNewCity(addr.city); setNewState(addr.state); setNewPincode(addr.pincode);
    setEditingAddressId(addr.id); setShowAddressForm(true);
  };

  const deleteAddress = async (id: string) => {
    const { error: delErr } = await supabase.from("addresses").delete().eq("id", id);
    if (delErr) { setError(delErr.message); return; }
    setAddresses((prev) => {
      const filtered = prev.filter((a) => a.id !== id);
      if (selectedAddressId === id) {
        setSelectedAddressId(filtered[0]?.id || "");
      }
      return filtered;
    });
  };

  const saveAddress = async () => {
    if (!profile?.id || !newLine1 || !newCity || !newState || !newPincode) {
      setError("Please fill in all address fields.");
      return;
    }
    setAddingAddress(true);
    setError(null);

    if (editingAddressId) {
      const { data, error: addrErr } = await supabase
        .from("addresses")
        .update({ label: newLabel || "Home", line1: newLine1, line2: newLine2 || null, city: newCity, state: newState, pincode: newPincode })
        .eq("id", editingAddressId)
        .select()
        .single();
      setAddingAddress(false);
      if (addrErr) { setError(addrErr.message); return; }
      setAddresses((prev) => prev.map((a) => a.id === editingAddressId ? (data as Address) : a));
    } else {
      const { data, error: addrErr } = await supabase
        .from("addresses")
        .insert({ profile_id: profile.id, label: newLabel || "Home", line1: newLine1, line2: newLine2 || null, city: newCity, state: newState, pincode: newPincode, country: "India" })
        .select()
        .single();
      setAddingAddress(false);
      if (addrErr) { setError(addrErr.message); return; }
      const newAddr = data as Address;
      setAddresses((prev) => [...prev, newAddr]);
      setSelectedAddressId(newAddr.id);
    }
    resetForm();
  };

  const placeOrder = async () => {
    if (!profile?.id) return;
    if (items.length === 0) return;
    if (!selectedAddressId) { setError("Please select a delivery address."); return; }

    setPlacing(true);
    setError(null);

    // 1. Validate stock and decrement atomically
    const stockItems = items.map((item) => ({
      seller_listing_id: item.product.sellerListingId,
      quantity: item.quantity,
      product_name: item.product.name,
    }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const stockRes = await fetch("/api/stock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ action: "validate_and_decrement", items: stockItems }),
      });

      const stockResult = await stockRes.json();

      if (!stockRes.ok) {
        if (stockResult.details) {
          setError("Some items are out of stock:\n" + stockResult.details.join("\n"));
        } else {
          setError(stockResult.error || "Failed to validate stock");
        }
        setPlacing(false);
        return;
      }
    } catch {
      setError("Failed to check stock availability. Please try again.");
      setPlacing(false);
      return;
    }

    // 2. Create the order via API (bypasses RLS)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const orderRes = await fetch("/api/place-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          profile_id: profile.id,
          address_id: selectedAddressId,
          total_amount: totalAmount + 5,
          items: items.map((item) => ({
            seller_listing_id: item.product.sellerListingId,
            quantity: item.quantity,
            price_at_purchase: item.product.price,
          })),
        }),
      });

      const orderResult = await orderRes.json();
      if (!orderRes.ok) {
        // Stock was decremented but order failed — restore stock
        await fetch("/api/stock", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            action: "validate_and_decrement",
            items: stockItems.map((i) => ({ ...i, quantity: -i.quantity })),
          }),
        }).catch(() => {});
        setError(orderResult.error || "Failed to place order");
        setPlacing(false);
        return;
      }

      clear();
      setOrderDone(orderResult.order_id);
      setPlacing(false);
    } catch {
      // Network error or unexpected failure — attempt stock rollback
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        await fetch("/api/stock", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(s?.access_token ? { Authorization: `Bearer ${s.access_token}` } : {}),
          },
          body: JSON.stringify({
            action: "validate_and_decrement",
            items: stockItems.map((i) => ({ ...i, quantity: -i.quantity })),
          }),
        });
      } catch {
        // rollback failed silently
      }
      setError("Something went wrong while placing your order. Please try again.");
      setPlacing(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f5f5f6]">
        <Navbar />
        <div className="flex flex-1 items-center justify-center">
          <div className="animate-spin h-8 w-8 rounded-full border-4 border-[#ff3f6c] border-t-transparent" />
        </div>
      </div>
    );
  }

  if (orderDone) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f5f5f6]">
        <Navbar />
        <main className="mx-auto w-full max-w-lg flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white p-10 space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-50">
              <svg className="h-8 w-8 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900">Order Confirmed!</h1>
            <p className="text-sm text-slate-500">
              Your order has been placed successfully. We&apos;ll notify you when it ships.
            </p>
            <p className="text-[10px] text-slate-400 font-mono break-all">Order ID: {orderDone}</p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="/dashboard"
                className="flex-1 bg-[#ff3f6c] py-3 text-sm font-bold uppercase tracking-wider text-white text-center transition hover:bg-[#e5355f]"
              >
                View My Orders
              </Link>
              <Link
                href="/products"
                className="flex-1 border-2 border-slate-300 py-3 text-sm font-bold uppercase tracking-wider text-slate-800 text-center transition hover:border-slate-900"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const platformFee = 5;
  const grandTotal = totalAmount + platformFee;
  const gstRate = 0.18;
  const basePrice = Math.round(totalAmount / (1 + gstRate));
  const gstAmount = totalAmount - basePrice;

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f6]">
      <Navbar />
      <main className="mx-auto w-full max-w-[1100px] px-4 py-5 flex-1">
        {/* Step tracker */}
        <div className="mb-6 flex items-center justify-center gap-0 text-xs font-bold uppercase tracking-wider">
          <span className="text-slate-400">Bag</span>
          <span className="mx-3 h-px w-10 bg-slate-300" />
          <span className="text-[#20bd99]">Address</span>
          <span className="mx-3 h-px w-10 bg-slate-300" />
          <span className="text-slate-400">Payment</span>
        </div>

        {items.length === 0 ? (
          <div className="mx-auto max-w-md bg-white p-12 text-center">
            <h2 className="text-lg font-bold text-slate-800">Your bag is empty</h2>
            <p className="text-sm text-slate-500 mt-1">Add items before checking out.</p>
            <Link
              href="/products"
              className="mt-5 inline-block border-2 border-[#ff3f6c] px-10 py-3 text-sm font-bold uppercase tracking-wider text-[#ff3f6c] transition hover:bg-[#ff3f6c] hover:text-white"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left column */}
            <div className="lg:col-span-8 space-y-4">
              {/* Delivery Address */}
              <section className="bg-white">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Select Delivery Address
                  </h2>
                </div>

                {addresses.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {addresses.map((addr) => (
                      <label
                        key={addr.id}
                        className={`flex items-start gap-3 px-5 py-4 cursor-pointer transition ${
                          selectedAddressId === addr.id ? "bg-pink-50/50" : "hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="address"
                          value={addr.id}
                          checked={selectedAddressId === addr.id}
                          onChange={() => setSelectedAddressId(addr.id)}
                          className="mt-0.5 accent-[#ff3f6c]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">{addr.label}</span>
                          </div>
                          <p className="mt-1 text-sm text-slate-800">{addr.line1}</p>
                          {addr.line2 && <p className="text-sm text-slate-500">{addr.line2}</p>}
                          <p className="text-sm text-slate-500">{addr.city}, {addr.state} — {addr.pincode}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button type="button" onClick={(e) => { e.preventDefault(); startEditAddress(addr); }}
                            className="text-xs font-bold text-slate-500 hover:text-[#ff3f6c] transition uppercase">
                            Edit
                          </button>
                          <button type="button" onClick={(e) => { e.preventDefault(); void deleteAddress(addr.id); }}
                            className="text-xs font-bold text-slate-500 hover:text-[#ff3f6c] transition uppercase">
                            Remove
                          </button>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="px-5 py-4 text-sm text-slate-500">No saved addresses. Add one below.</p>
                )}

                {showAddressForm ? (
                  <div className="border-t border-slate-100 px-5 py-4 space-y-3">
                    <p className="text-sm font-bold text-slate-800">{editingAddressId ? "Edit Address" : "Add New Address"}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="text-xs font-medium text-slate-500">Label</label>
                        <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Home / Work / Other"
                          className="mt-1 w-full border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:border-[#ff3f6c]" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs font-medium text-slate-500">Street / Flat / Building *</label>
                        <input value={newLine1} onChange={(e) => setNewLine1(e.target.value)} placeholder="123 MG Road, Apt 4B"
                          className="mt-1 w-full border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:border-[#ff3f6c]" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs font-medium text-slate-500">Area / Landmark (optional)</label>
                        <input value={newLine2} onChange={(e) => setNewLine2(e.target.value)} placeholder="Near City Mall"
                          className="mt-1 w-full border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:border-[#ff3f6c]" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500">City *</label>
                        <input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="Mumbai"
                          className="mt-1 w-full border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:border-[#ff3f6c]" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500">State *</label>
                        <select value={newState} onChange={(e) => setNewState(e.target.value)}
                          className="mt-1 w-full border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:border-[#ff3f6c] bg-white">
                          <option value="">Select State</option>
                          {["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Jammu and Kashmir","Ladakh","Chandigarh","Puducherry"].map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500">PIN Code *</label>
                        <input value={newPincode} onChange={(e) => setNewPincode(e.target.value)} placeholder="400001"
                          className="mt-1 w-full border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:border-[#ff3f6c]" />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => void saveAddress()} disabled={addingAddress}
                        className="bg-[#ff3f6c] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#e5355f] disabled:opacity-50 transition">
                        {addingAddress ? "Saving..." : editingAddressId ? "Update" : "Save Address"}
                      </button>
                      <button onClick={resetForm}
                        className="border border-slate-300 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:border-slate-900 transition">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-slate-100 px-5 py-4">
                    <button onClick={() => { resetForm(); setShowAddressForm(true); }}
                      className="text-sm font-bold text-[#ff3f6c] uppercase hover:underline">
                      + Add New Address
                    </button>
                  </div>
                )}
              </section>

              {/* Order Items */}
              <section className="bg-white">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Order Summary ({totalItems} Item{totalItems !== 1 ? "s" : ""})
                  </h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {items.map(({ product, quantity }) => (
                    <div key={product.variantId ? `${product.id}::${product.variantId}` : product.id} className="flex justify-between items-center px-5 py-3.5">
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="text-sm font-bold text-slate-800 truncate">{product.name}</p>
                        {product.brand && <p className="text-xs text-slate-400 truncate">{product.brand}</p>}
                        {product.variantTitle && <p className="text-xs text-slate-400">{product.variantTitle}</p>}
                        <p className="mt-1 text-xs text-slate-400">Qty: {quantity}</p>
                      </div>
                      <span className="text-sm font-bold text-slate-900 shrink-0">{formatRupee(product.price * quantity)}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Payment Method */}
              <section className="bg-white">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Payment Method</h2>
                </div>
                <div className="px-5 py-4">
                  <div className="flex items-center gap-3 rounded border border-teal-200 bg-teal-50 p-3">
                    <input type="radio" checked readOnly className="accent-teal-600" />
                    <div>
                      <p className="text-sm font-bold text-slate-800">Cash on Delivery</p>
                      <p className="text-xs text-slate-500">Pay when your order arrives at your doorstep</p>
                    </div>
                    <span className="ml-auto rounded bg-teal-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Active</span>
                  </div>
                </div>
              </section>
            </div>

            {/* Right column — Price Details */}
            <div className="lg:col-span-4">
              <div className="sticky top-24 bg-white">
                <h2 className="border-b border-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Price Details ({totalItems} Item{totalItems !== 1 ? "s" : ""})
                </h2>

                <div className="space-y-3 px-4 py-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total MRP</span>
                    <span className="text-slate-800">{formatRupee(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Discount on MRP</span>
                    <span className="text-teal-600">-₹0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Convenience Fee</span>
                    <span className="text-slate-800">{formatRupee(platformFee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Delivery Charges</span>
                    <span className="text-teal-600">
                      <span className="mr-1 text-slate-400 line-through">₹99</span>
                      FREE
                    </span>
                  </div>

                  <div className="border-t border-dashed border-slate-200 pt-3 flex justify-between font-bold">
                    <span className="text-slate-800">Total Amount</span>
                    <span className="text-slate-900">{formatRupee(grandTotal)}</span>
                  </div>

                  <div className="border-t border-slate-100 pt-2 text-xs text-slate-400 space-y-1">
                    <p className="flex justify-between">
                      <span>Taxable Value</span>
                      <span>{formatRupee(basePrice)}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>GST (18%) — included</span>
                      <span>{formatRupee(gstAmount)}</span>
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="mx-4 mb-3 rounded bg-red-50 border border-red-200 p-3 text-xs text-red-700">{error}</div>
                )}

                <div className="px-4 pb-4 space-y-3">
                  <button
                    onClick={() => void placeOrder()}
                    disabled={placing || !selectedAddressId}
                    className="w-full bg-[#ff3f6c] py-3.5 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#e5355f] disabled:opacity-50"
                  >
                    {placing ? "Confirming Order..." : "Place Order"}
                  </button>
                  <Link href="/cart" className="block text-center text-xs font-bold text-[#ff3f6c] hover:underline uppercase">
                    Back to Bag
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
