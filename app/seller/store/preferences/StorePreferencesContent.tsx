"use client";

import { useEffect, useState } from "react";

const PRESET_COLORS = [
  "#4f46e5", "#7c3aed", "#db2777", "#dc2626",
  "#ea580c", "#d97706", "#16a34a", "#0891b2",
  "#2563eb", "#1d4ed8", "#0f172a", "#6b7280",
];

const STORAGE_KEY = "shopora-store-preferences";

type Preferences = {
  themeColor: string;
  announcement: string;
  instagram: string;
  facebook: string;
  twitter: string;
  showPolicies: boolean;
};

const DEFAULT_PREFS: Preferences = {
  themeColor: "#4f46e5",
  announcement: "",
  instagram: "",
  facebook: "",
  twitter: "",
  showPolicies: true,
};

export default function StorePreferencesContent() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
    } catch {
      /* ignore */
    }
  }, []);

  const update = (key: keyof Preferences, value: string | boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Store Preferences</h1>
        <p className="mt-1 text-sm text-gray-500">
          Customize the look and feel of your online store.
        </p>
      </div>

      {/* Theme color */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          Theme Color
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Choose a primary color for your store branding.
        </p>
        <div className="flex flex-wrap gap-3">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => update("themeColor", color)}
              className={`h-10 w-10 rounded-lg border-2 transition ${
                prefs.themeColor === color
                  ? "border-gray-900 scale-110 shadow-md"
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: color }}
              aria-label={`Select color ${color}`}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <label className="text-xs text-gray-500">Custom:</label>
          <input
            type="color"
            value={prefs.themeColor}
            onChange={(e) => update("themeColor", e.target.value)}
            className="h-8 w-8 cursor-pointer rounded border border-gray-300"
          />
          <span className="text-xs text-gray-500 font-mono">
            {prefs.themeColor}
          </span>
        </div>
      </div>

      {/* Announcement bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          Announcement Bar
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          Display a message at the top of your store. Leave empty to hide.
        </p>
        <input
          type="text"
          value={prefs.announcement}
          onChange={(e) => update("announcement", e.target.value)}
          placeholder="e.g. Free shipping on orders above Rs. 999!"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
        />
        {prefs.announcement && (
          <div
            className="mt-3 rounded-lg px-4 py-2 text-center text-xs font-medium text-white"
            style={{ backgroundColor: prefs.themeColor }}
          >
            {prefs.announcement}
          </div>
        )}
      </div>

      {/* Social media */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          Social Media Links
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Instagram
            </label>
            <input
              type="url"
              value={prefs.instagram}
              onChange={(e) => update("instagram", e.target.value)}
              placeholder="https://instagram.com/yourstore"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Facebook
            </label>
            <input
              type="url"
              value={prefs.facebook}
              onChange={(e) => update("facebook", e.target.value)}
              placeholder="https://facebook.com/yourstore"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Twitter / X
            </label>
            <input
              type="url"
              value={prefs.twitter}
              onChange={(e) => update("twitter", e.target.value)}
              placeholder="https://x.com/yourstore"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Store policies display */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Show Store Policies
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Display shipping, return, and privacy policies in your store footer.
            </p>
          </div>
          <button
            onClick={() => update("showPolicies", !prefs.showPolicies)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              prefs.showPolicies ? "bg-indigo-500" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                prefs.showPolicies ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-600"
        >
          Save Preferences
        </button>
        {saved && (
          <span className="text-sm text-green-600 font-medium">
            Preferences saved!
          </span>
        )}
      </div>
    </div>
  );
}
