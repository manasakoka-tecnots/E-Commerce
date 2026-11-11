"use client";

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/src/lib/supabase/client";
import Spinner from "@/src/components/Spinner";

type StoreProfile = {
  id: string;
  user_id: string;
  business_name: string;
  logo_url: string | null;
  banner_url: string | null;
  description: string | null;
  slug: string | null;
  theme_color: string;
  social_facebook: string;
  social_instagram: string;
  social_twitter: string;
  social_youtube: string;
  contact_email: string;
  contact_phone: string;
};

const COLOR_SCHEMES = [
  { name: "Indigo", value: "#4f46e5", bg: "bg-indigo-500" },
  { name: "Blue", value: "#2563eb", bg: "bg-blue-600" },
  { name: "Emerald", value: "#059669", bg: "bg-indigo-500" },
  { name: "Rose", value: "#e11d48", bg: "bg-rose-600" },
  { name: "Amber", value: "#d97706", bg: "bg-amber-600" },
  { name: "Purple", value: "#9333ea", bg: "bg-purple-600" },
  { name: "Slate", value: "#475569", bg: "bg-slate-600" },
  { name: "Teal", value: "#0d9488", bg: "bg-teal-600" },
];

export default function StoreContent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [themeColor, setThemeColor] = useState("#4f46e5");
  const [socialFacebook, setSocialFacebook] = useState("");
  const [socialInstagram, setSocialInstagram] = useState("");
  const [socialTwitter, setSocialTwitter] = useState("");
  const [socialYoutube, setSocialYoutube] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  const loadStore = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_uid", userData.user.id)
      .maybeSingle();
    if (!profile) {
      setLoading(false);
      return;
    }
    const { data: seller } = await supabase
      .from("sellers")
      .select("*")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (seller) {
      setSellerId(seller.id);
      setBusinessName(seller.business_name ?? "");
      setDescription(seller.description ?? "");
      setSlug(seller.slug ?? "");
      setThemeColor(seller.theme_color ?? "#4f46e5");
      setSocialFacebook(seller.social_facebook ?? "");
      setSocialInstagram(seller.social_instagram ?? "");
      setSocialTwitter(seller.social_twitter ?? "");
      setSocialYoutube(seller.social_youtube ?? "");
      setContactEmail(seller.contact_email ?? userData.user.email ?? "");
      setContactPhone(seller.contact_phone ?? "");
      setLogoUrl(seller.logo_url ?? null);
      setBannerUrl(seller.banner_url ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStore();
  }, [loadStore]);

  const handleImageUpload = async (
    file: File,
    type: "logo" | "banner"
  ) => {
    if (!sellerId) return;
    const ext = file.name.split(".").pop();
    const path = `sellers/${sellerId}/${type}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("store-assets")
      .upload(path, file, { upsert: true });

    if (upErr) {
      setError(`Upload failed: ${upErr.message}`);
      return;
    }

    const { data: urlData } = supabase.storage.from("store-assets").getPublicUrl(path);
    const url = urlData.publicUrl;

    if (type === "logo") {
      setLogoUrl(url);
      await supabase.from("sellers").update({ logo_url: url }).eq("id", sellerId);
    } else {
      setBannerUrl(url);
      await supabase.from("sellers").update({ banner_url: url }).eq("id", sellerId);
    }
    setSuccess(`${type === "logo" ? "Logo" : "Banner"} uploaded!`);
  };

  const handleSave = async () => {
    if (!sellerId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const { error: updErr } = await supabase
      .from("sellers")
      .update({
        business_name: businessName,
        description,
        slug,
        theme_color: themeColor,
        social_facebook: socialFacebook,
        social_instagram: socialInstagram,
        social_twitter: socialTwitter,
        social_youtube: socialYoutube,
        contact_email: contactEmail,
        contact_phone: contactPhone,
      })
      .eq("id", sellerId);

    if (updErr) setError(updErr.message);
    else setSuccess("Store profile saved!");
    setSaving(false);
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
            <h1 className="text-2xl font-bold text-gray-900">Online Store</h1>
            <p className="mt-1 text-sm text-gray-500">
              Customize your storefront appearance and information.
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

          {/* Store Profile */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Store Profile</h2>

            <div className="grid gap-6 sm:grid-cols-2">
              {/* Logo Upload */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Store Logo</label>
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                    ) : (
                      <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                      </svg>
                    )}
                  </div>
                  <label className="cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50">
                    Upload Logo
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImageUpload(f, "logo");
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Banner Upload */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Store Banner
                </label>
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-28 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                    {bannerUrl ? (
                      <img src={bannerUrl} alt="Banner" className="h-full w-full object-cover" />
                    ) : (
                      <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                      </svg>
                    )}
                  </div>
                  <label className="cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50">
                    Upload Banner
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImageUpload(f, "banner");
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Store Description */}
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Store Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  placeholder="Tell customers about your store..."
                />
              </div>
            </div>
          </div>

          {/* Store URL */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Store URL</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">shopora.com/store/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) =>
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "-")
                      .replace(/-+/g, "-")
                  )
                }
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                placeholder="my-store"
              />
            </div>
          </div>

          {/* Theme Preferences */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Theme Preferences</h2>
            <p className="mb-3 text-sm text-gray-500">Choose a color scheme for your storefront.</p>
            <div className="flex flex-wrap gap-3">
              {COLOR_SCHEMES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setThemeColor(c.value)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                    themeColor === c.value
                      ? "border-indigo-400 bg-indigo-50 font-medium text-indigo-600"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full ${c.bg}`} />
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Social Media Links */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Social Media Links</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Facebook</label>
                <input
                  type="url"
                  value={socialFacebook}
                  onChange={(e) => setSocialFacebook(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  placeholder="https://facebook.com/yourstore"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Instagram</label>
                <input
                  type="url"
                  value={socialInstagram}
                  onChange={(e) => setSocialInstagram(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  placeholder="https://instagram.com/yourstore"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Twitter / X</label>
                <input
                  type="url"
                  value={socialTwitter}
                  onChange={(e) => setSocialTwitter(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  placeholder="https://x.com/yourstore"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">YouTube</label>
                <input
                  type="url"
                  value={socialYoutube}
                  onChange={(e) => setSocialYoutube(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  placeholder="https://youtube.com/@yourstore"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Contact Information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  placeholder="support@yourstore.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-indigo-500 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    
  );
}
