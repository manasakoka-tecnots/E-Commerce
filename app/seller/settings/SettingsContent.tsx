"use client";

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/src/lib/supabase/client";
import { useStaff } from "@/src/context/StaffContext";
import Spinner from "@/src/components/Spinner";

type Tab = "general" | "payments" | "shipping" | "notifications" | "account";

const TABS: { key: Tab; label: string }[] = [
  { key: "general", label: "General" },
  { key: "payments", label: "Payments" },
  { key: "shipping", label: "Shipping" },
  { key: "notifications", label: "Notifications" },
  { key: "account", label: "Account" },
];

export default function SettingsContent() {
  const { sellerId: staffSellerId, isOwner, staffRole } = useStaff();
  const canEditSettings = isOwner || staffRole === 'admin';
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");

  // General
  const [storeName, setStoreName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [gstin, setGstin] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");

  // Payments
  const [bankAccount, setBankAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [bankName, setBankName] = useState("");
  const [upiId, setUpiId] = useState("");

  // Shipping
  const [defaultShippingFee, setDefaultShippingFee] = useState("");
  const [freeShippingThreshold, setFreeShippingThreshold] = useState("");
  const [processingTime, setProcessingTime] = useState("2-3 business days");

  // Notifications
  const [notifyNewOrder, setNotifyNewOrder] = useState(true);
  const [notifyLowStock, setNotifyLowStock] = useState(true);
  const [notifyPayout, setNotifyPayout] = useState(true);

  // Account
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }
    setUserEmail(userData.user.email ?? "");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_uid", userData.user.id)
      .maybeSingle();
    if (!profile) {
      setLoading(false);
      return;
    }
    let resolvedSellerId = staffSellerId;
    if (!resolvedSellerId) {
      const { data: sellerRow } = await supabase
        .from("sellers")
        .select("id")
        .eq("profile_id", profile.id)
        .maybeSingle();
      resolvedSellerId = sellerRow?.id ?? null;
    }

    if (!resolvedSellerId) {
      setLoading(false);
      return;
    }

    const { data: seller } = await supabase
      .from("sellers")
      .select("*")
      .eq("id", resolvedSellerId)
      .maybeSingle();

    if (seller) {
      setSellerId(seller.id);
      setStoreName(seller.business_name ?? "");
      setBusinessType(seller.business_type ?? "");
      setGstin(seller.gst_number ?? "");
      setBusinessAddress(seller.business_address ?? "");
      setBankAccount(seller.bank_account ?? "");
      setIfsc(seller.bank_ifsc ?? "");
      setBankName(seller.bank_name ?? "");
      setUpiId(seller.upi_id ?? "");
      setDefaultShippingFee(seller.default_shipping_fee?.toString() ?? "");
      setFreeShippingThreshold(seller.free_shipping_threshold?.toString() ?? "");
      setProcessingTime(seller.processing_time ?? "2-3 business days");
      setNotifyNewOrder(seller.notify_new_order ?? true);
      setNotifyLowStock(seller.notify_low_stock ?? true);
      setNotifyPayout(seller.notify_payout ?? true);
    }
    setLoading(false);
  }, [staffSellerId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveGeneral = async () => {
    if (!sellerId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const { error: updErr } = await supabase
      .from("sellers")
      .update({
        business_name: storeName,
        business_type: businessType,
        gst_number: gstin,
        business_address: businessAddress,
      })
      .eq("id", sellerId);

    if (updErr) setError(updErr.message);
    else setSuccess("General settings saved!");
    setSaving(false);
  };

  const handleSavePayments = async () => {
    if (!sellerId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const { error: updErr } = await supabase
      .from("sellers")
      .update({
        bank_account: bankAccount,
        bank_ifsc: ifsc,
        bank_name: bankName,
        upi_id: upiId,
      })
      .eq("id", sellerId);

    if (updErr) setError(updErr.message);
    else setSuccess("Payment settings saved!");
    setSaving(false);
  };

  const handleSaveShipping = async () => {
    if (!sellerId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const { error: updErr } = await supabase
      .from("sellers")
      .update({
        default_shipping_fee: defaultShippingFee ? parseFloat(defaultShippingFee) : null,
        free_shipping_threshold: freeShippingThreshold
          ? parseFloat(freeShippingThreshold)
          : null,
        processing_time: processingTime,
      })
      .eq("id", sellerId);

    if (updErr) setError(updErr.message);
    else setSuccess("Shipping settings saved!");
    setSaving(false);
  };

  const handleSaveNotifications = async () => {
    if (!sellerId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const { error: updErr } = await supabase
      .from("sellers")
      .update({
        notify_new_order: notifyNewOrder,
        notify_low_stock: notifyLowStock,
        notify_payout: notifyPayout,
      })
      .eq("id", sellerId);

    if (updErr) setError(updErr.message);
    else setSuccess("Notification preferences saved!");
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    const { error: pwErr } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (pwErr) setError(pwErr.message);
    else {
      setSuccess("Password updated!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (
      !confirm(
        "Are you sure you want to delete your account? This action is irreversible and will remove all your store data."
      )
    )
      return;

    setError(null);
    setSuccess(null);
    // Mark seller as deleted rather than actually deleting
    if (sellerId) {
      const { error: updErr } = await supabase
        .from("sellers")
        .update({ status: "deleted" })
        .eq("id", sellerId);
      if (updErr) {
        setError(updErr.message);
        return;
      }
    }
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (loading) {
    return (
      
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <Spinner />
        </div>
      
    );
  }

  return (
    
      <div className="min-h-screen bg-gray-50 p-6 md:p-10">
        <div className="mx-auto max-w-4xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your store settings, payments, shipping, and account.
            </p>
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

          {!canEditSettings && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              You are viewing settings as staff. Only the store owner or admin can make changes.
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setActiveTab(t.key);
                  setError(null);
                  setSuccess(null);
                }}
                className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition ${
                  activeTab === t.key
                    ? "bg-indigo-500 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* General Tab */}
          {activeTab === "general" && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">General Information</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Store Name
                  </label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    placeholder="My Store"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Business Type
                  </label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  >
                    <option value="">Select type</option>
                    <option value="individual">Individual</option>
                    <option value="sole_proprietorship">Sole Proprietorship</option>
                    <option value="partnership">Partnership</option>
                    <option value="pvt_ltd">Private Limited</option>
                    <option value="llp">LLP</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">GSTIN</label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    placeholder="22AAAAA0000A1Z5"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Business Address
                  </label>
                  <textarea
                    value={businessAddress}
                    onChange={(e) => setBusinessAddress(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    placeholder="Full business address..."
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSaveGeneral}
                  disabled={saving || !canEditSettings}
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === "payments" && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Payment Details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Bank Account Number
                  </label>
                  <input
                    type="text"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    placeholder="1234567890"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">IFSC Code</label>
                  <input
                    type="text"
                    value={ifsc}
                    onChange={(e) => setIfsc(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    placeholder="SBIN0001234"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Bank Name</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    placeholder="State Bank of India"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">UPI ID</label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    placeholder="yourstore@upi"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSavePayments}
                  disabled={saving || !canEditSettings}
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}

          {/* Shipping Tab */}
          {activeTab === "shipping" && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Shipping Settings</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Default Shipping Fee (INR)
                  </label>
                  <input
                    type="number"
                    value={defaultShippingFee}
                    onChange={(e) => setDefaultShippingFee(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    placeholder="50"
                    min="0"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Free Shipping Threshold (INR)
                  </label>
                  <input
                    type="number"
                    value={freeShippingThreshold}
                    onChange={(e) => setFreeShippingThreshold(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    placeholder="999"
                    min="0"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Processing Time
                  </label>
                  <select
                    value={processingTime}
                    onChange={(e) => setProcessingTime(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  >
                    <option value="1 business day">1 business day</option>
                    <option value="2-3 business days">2-3 business days</option>
                    <option value="3-5 business days">3-5 business days</option>
                    <option value="5-7 business days">5-7 business days</option>
                    <option value="1-2 weeks">1-2 weeks</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Shipping Zones
                  </label>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-4 text-center">
                    <p className="text-xs text-gray-400">
                      Shipping zones configuration coming soon
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSaveShipping}
                  disabled={saving || !canEditSettings}
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Notification Preferences
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">New Order</p>
                    <p className="text-xs text-gray-500">
                      Get notified via email when you receive a new order.
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={notifyNewOrder}
                      onChange={(e) => setNotifyNewOrder(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="h-5 w-9 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-indigo-500 peer-checked:after:translate-x-full"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Low Stock Alert</p>
                    <p className="text-xs text-gray-500">
                      Get notified when a product&apos;s stock falls below threshold.
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={notifyLowStock}
                      onChange={(e) => setNotifyLowStock(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="h-5 w-9 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-indigo-500 peer-checked:after:translate-x-full"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Payout Notification</p>
                    <p className="text-xs text-gray-500">
                      Get notified when a payout is processed to your bank account.
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={notifyPayout}
                      onChange={(e) => setNotifyPayout(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="h-5 w-9 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-indigo-500 peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSaveNotifications}
                  disabled={saving || !canEditSettings}
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}

          {/* Account Tab */}
          {activeTab === "account" && (
            <div className="space-y-6">
              {/* Email */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Account Email</h2>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={userEmail}
                    disabled
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Email cannot be changed from here.
                  </p>
                </div>
              </div>

              {/* Change Password */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Change Password</h2>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleChangePassword}
                    disabled={saving}
                    className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
                  >
                    {saving ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="rounded-xl border border-red-200 bg-white p-6 shadow-sm">
                <h2 className="mb-2 text-lg font-semibold text-red-600">Danger Zone</h2>
                <p className="mb-4 text-sm text-gray-500">
                  Deleting your account is permanent. All your store data, listings, and order
                  history will be removed.
                </p>
                <button
                  onClick={handleDeleteAccount}
                  disabled={!canEditSettings}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Delete Account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    
  );
}
