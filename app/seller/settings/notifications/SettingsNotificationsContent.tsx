"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";

type NotifPrefs = {
  email_new_order: boolean;
  email_low_stock: boolean;
  email_payout: boolean;
  email_review: boolean;
};

const DEFAULT_PREFS: NotifPrefs = {
  email_new_order: true,
  email_low_stock: true,
  email_payout: true,
  email_review: false,
};

const PREF_LABELS: { key: keyof NotifPrefs; label: string; description: string }[] = [
  {
    key: "email_new_order",
    label: "New Order",
    description: "Receive an email whenever a customer places a new order.",
  },
  {
    key: "email_low_stock",
    label: "Low Stock Alert",
    description: "Get notified when a product's stock falls below the threshold.",
  },
  {
    key: "email_payout",
    label: "Payout Processed",
    description: "Receive an email when a payout is sent to your bank account.",
  },
  {
    key: "email_review",
    label: "New Review",
    description: "Get notified when a customer leaves a review on your product.",
  },
];

export default function SettingsNotificationsContent() {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sellerId, setSellerId] = useState<string | null>(null);

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
        .select("id, notification_preferences")
        .eq("profile_id", profile.id)
        .maybeSingle();

      if (seller) {
        setSellerId(seller.id);
        if (seller.notification_preferences) {
          setPrefs({ ...DEFAULT_PREFS, ...seller.notification_preferences });
        }
      }
      setLoading(false);
    })();
  }, []);

  const toggle = (key: keyof NotifPrefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
    setSuccess(false);
  };

  const handleSave = async () => {
    if (!sellerId) return;
    setSaving(true);
    setSuccess(false);

    await supabase
      .from("sellers")
      .update({ notification_preferences: prefs })
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
        <h1 className="text-2xl font-bold text-gray-900">
          Notification Preferences
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Choose which email notifications you want to receive.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        {PREF_LABELS.map(({ key, label, description }) => (
          <div
            key={key}
            className="flex items-center justify-between p-6"
          >
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{description}</p>
            </div>
            <button
              onClick={() => toggle(key)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                prefs[key] ? "bg-indigo-500" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  prefs[key] ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Preferences"}
        </button>
        {success && (
          <span className="text-sm text-green-600 font-medium">
            Notification preferences saved!
          </span>
        )}
      </div>
    </div>
  );
}
