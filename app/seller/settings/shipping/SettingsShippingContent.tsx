"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";
import { useStaff } from "@/src/context/StaffContext";

const PROCESSING_TIMES = [
  "1-2 business days",
  "2-3 business days",
  "3-5 business days",
  "5-7 business days",
  "7-10 business days",
];

export default function SettingsShippingContent() {
  const { sellerId: staffSellerId } = useStaff();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sellerId, setSellerId] = useState<string | null>(null);

  const [shippingFee, setShippingFee] = useState("50");
  const [freeShippingThreshold, setFreeShippingThreshold] = useState("999");
  const [processingTime, setProcessingTime] = useState(PROCESSING_TIMES[1]);

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
        .select("shipping_fee, free_shipping_threshold, processing_time")
        .eq("id", resolvedSellerId)
        .maybeSingle();

      if (sellerData) {
        if (sellerData.shipping_fee != null) setShippingFee(String(sellerData.shipping_fee));
        if (sellerData.free_shipping_threshold != null)
          setFreeShippingThreshold(String(sellerData.free_shipping_threshold));
        if (sellerData.processing_time) setProcessingTime(sellerData.processing_time);
      }
      setLoading(false);
    })();
  }, [staffSellerId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerId) return;

    setSaving(true);
    setSuccess(false);

    await supabase
      .from("sellers")
      .update({
        shipping_fee: parseFloat(shippingFee) || 0,
        free_shipping_threshold: parseFloat(freeShippingThreshold) || 0,
        processing_time: processingTime,
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
        <h1 className="text-2xl font-bold text-gray-900">Shipping Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure default shipping rates and processing times.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Shipping Rates
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Default Shipping Fee (INR)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  Rs.
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={shippingFee}
                  onChange={(e) => setShippingFee(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Free Shipping Threshold (INR)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  Rs.
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={freeShippingThreshold}
                  onChange={(e) => setFreeShippingThreshold(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Orders above this amount get free shipping. Set to 0 to disable.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Processing Time
          </h2>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Default Processing Time
            </label>
            <select
              value={processingTime}
              onChange={(e) => setProcessingTime(e.target.value)}
              className="w-full sm:w-80 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none bg-white"
            >
              {PROCESSING_TIMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Time to prepare and ship an order after payment confirmation.
            </p>
          </div>
        </div>

        {/* Shipping zones placeholder */}
        <div className="bg-gray-50 border-dashed border-2 border-gray-200 rounded-xl p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-900">
            Shipping Zones -- Coming Soon
          </h2>
          <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
            Define different shipping rates for different regions and pin code ranges.
          </p>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Shipping Settings"}
          </button>
          {success && (
            <span className="text-sm text-green-600 font-medium">
              Shipping settings saved!
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
