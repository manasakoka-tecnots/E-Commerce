"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";
import { useStaff } from "@/src/context/StaffContext";

export default function SettingsAccountContent() {
  const { sellerId: staffSellerId } = useStaff();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);

  // Save name
  const [savingName, setSavingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);

  // Change password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Deactivate
  const [deactivateConfirm, setDeactivateConfirm] = useState("");
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { setLoading(false); return; }

      setEmail(userData.user.email || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("auth_uid", userData.user.id)
        .maybeSingle();

      if (profile) {
        setProfileId(profile.id);
        setFullName(profile.full_name || "");
      }
      setLoading(false);
    })();
  }, []);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId) return;
    setSavingName(true);
    setNameSuccess(false);

    await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", profileId);

    setSavingName(false);
    setNameSuccess(true);
    setTimeout(() => setNameSuccess(false), 3000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setPasswordSaving(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    }
    setPasswordSaving(false);
  };

  const handleDeactivate = async () => {
    if (deactivateConfirm !== "DEACTIVATE") {
      alert('Please type "DEACTIVATE" to confirm.');
      return;
    }

    if (!confirm("Are you sure you want to deactivate your seller account? This action cannot be undone easily.")) {
      return;
    }

    setDeactivating(true);

    if (profileId) {
      await supabase
        .from("sellers")
        .update({ status: "deactivated" })
        .eq("profile_id", profileId);
    }

    await supabase.auth.signOut();
    window.location.href = "/";
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
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account details and security.
        </p>
      </div>

      {/* Email (read-only) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          Email Address
        </h2>
        <div className="flex items-center gap-3">
          <input
            type="email"
            value={email}
            readOnly
            className="w-full sm:w-80 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
          />
          <span className="text-xs text-gray-400">Read only</span>
        </div>
      </div>

      {/* Name */}
      <form onSubmit={handleSaveName} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          Full Name
        </h2>
        <div className="flex items-end gap-3">
          <div className="flex-1 sm:max-w-sm">
            <input
              type="text"
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); setNameSuccess(false); }}
              placeholder="Your full name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={savingName}
            className="bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
          >
            {savingName ? "Saving..." : "Update Name"}
          </button>
          {nameSuccess && (
            <span className="text-sm text-green-600 font-medium">Saved!</span>
          )}
        </div>
      </form>

      {/* Change password */}
      <form onSubmit={handleChangePassword} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">
          Change Password
        </h2>
        {passwordError && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {passwordError}
          </div>
        )}
        {passwordSuccess && (
          <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            Password updated successfully!
          </div>
        )}
        <div className="space-y-3 max-w-sm">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={passwordSaving}
            className="bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
          >
            {passwordSaving ? "Updating..." : "Change Password"}
          </button>
        </div>
      </form>

      {/* Danger zone */}
      <div className="bg-white rounded-xl border border-red-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-red-600 mb-2">
          Danger Zone
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Deactivating your account will disable your store and remove your
          products from the marketplace. This action requires confirmation.
        </p>
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Type &quot;DEACTIVATE&quot; to confirm
            </label>
            <input
              type="text"
              value={deactivateConfirm}
              onChange={(e) => setDeactivateConfirm(e.target.value)}
              placeholder="DEACTIVATE"
              className="w-60 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500/30 focus:border-red-500 outline-none"
            />
          </div>
          <button
            onClick={handleDeactivate}
            disabled={deactivating || deactivateConfirm !== "DEACTIVATE"}
            className="bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {deactivating ? "Deactivating..." : "Deactivate Account"}
          </button>
        </div>
      </div>
    </div>
  );
}
