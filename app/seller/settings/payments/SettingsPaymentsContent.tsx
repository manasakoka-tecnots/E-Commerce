"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";
import { useStaff } from "@/src/context/StaffContext";

export default function SettingsPaymentsContent() {
  const { sellerId: staffSellerId } = useStaff();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sellerId, setSellerId] = useState<string | null>(null);

  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [bankName, setBankName] = useState("");
  const [branch, setBranch] = useState("");
  const [upiId, setUpiId] = useState("");

  useEffect(() => {
    (async () => {
      let resolvedSellerId = staffSellerId;
      if (!resolvedSellerId) {
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
        resolvedSellerId = seller?.id ?? null;
      }
      if (!resolvedSellerId) { setLoading(false); return; }

      setSellerId(resolvedSellerId);

      const { data: sellerData } = await supabase
        .from("sellers")
        .select("bank_account_number, bank_ifsc, bank_name, bank_branch, upi_id")
        .eq("id", resolvedSellerId)
        .maybeSingle();

      if (sellerData) {
        setAccountNumber(sellerData.bank_account_number || "");
        setConfirmAccountNumber(sellerData.bank_account_number || "");
        setIfsc(sellerData.bank_ifsc || "");
        setBankName(sellerData.bank_name || "");
        setBranch(sellerData.bank_branch || "");
        setUpiId(sellerData.upi_id || "");
      }
      setLoading(false);
    })();
  }, [staffSellerId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerId) return;
    if (accountNumber !== confirmAccountNumber) {
      alert("Account numbers do not match.");
      return;
    }

    setSaving(true);
    setSuccess(false);

    await supabase
      .from("sellers")
      .update({
        bank_account_number: accountNumber,
        bank_ifsc: ifsc,
        bank_name: bankName,
        bank_branch: branch,
        upi_id: upiId,
      })
      .eq("id", sellerId);

    setSaving(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

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
        <h1 className="text-2xl font-bold text-gray-900">Payment Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure your bank account and UPI details for payouts.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Bank details */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Bank Account Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Bank Name
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="State Bank of India"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Branch
              </label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="Main Branch, Mumbai"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Account Number
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Enter account number"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Confirm Account Number
              </label>
              <input
                type="text"
                value={confirmAccountNumber}
                onChange={(e) => setConfirmAccountNumber(e.target.value)}
                placeholder="Re-enter account number"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                IFSC Code
              </label>
              <input
                type="text"
                value={ifsc}
                onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                placeholder="SBIN0001234"
                maxLength={11}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
              />
            </div>
          </div>
        </div>

        {/* UPI */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            UPI Details
          </h2>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              UPI ID
            </label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="yourname@upi"
              className="w-full sm:w-80 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
            />
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Payment Details"}
          </button>
          {success && (
            <span className="text-sm text-green-600 font-medium">
              Payment details saved!
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
