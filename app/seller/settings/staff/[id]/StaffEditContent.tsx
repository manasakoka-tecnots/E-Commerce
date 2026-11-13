"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/src/lib/supabase/client";
import { useStaff } from "@/src/context/StaffContext";

// ── Types ────────────────────────────────────────────────────────────
type StaffRole = "admin" | "manager" | "associate";
type StaffStatus = "invited" | "active" | "inactive" | "removed";

type StaffRecord = {
  id: string;
  seller_id: string;
  name: string;
  email: string;
  phone: string | null;
  role: StaffRole;
  status: StaffStatus;
  pin_code: string | null;
  invited_at: string | null;
  activated_at: string | null;
  last_login_at: string | null;
};

type SellerLocation = {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
};

type LocationAssignment = {
  location_id: string;
  permissions: string[];
};

// ── Permission definitions ───────────────────────────────────────────
const ALL_PERMISSIONS = [
  { key: "inventory_view", label: "View inventory" },
  { key: "inventory_edit", label: "Edit inventory & adjustments" },
  { key: "transfers_create", label: "Create transfers" },
  { key: "transfers_manage", label: "Manage & receive transfers" },
  { key: "orders_view", label: "View orders" },
  { key: "orders_fulfill", label: "Fulfill orders" },
] as const;

const VIEW_PERMISSIONS = ["inventory_view", "orders_view"];
const ALL_PERMISSION_KEYS = ALL_PERMISSIONS.map((p) => p.key);

function getDefaultPermissions(role: StaffRole): string[] {
  if (role === "admin" || role === "manager") return [...ALL_PERMISSION_KEYS];
  return [...VIEW_PERMISSIONS];
}

// ── Helpers ──────────────────────────────────────────────────────────
function formatDate(iso: string | null): string {
  if (!iso) return "---";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Component ────────────────────────────────────────────────────────
export default function StaffEditContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: staffId } = React.use(params);
  const {
    sellerId: staffSellerId,
    isOwner,
    staffRole,
    loading: staffLoading,
  } = useStaff();

  // Data
  const [staff, setStaff] = useState<StaffRecord | null>(null);
  const [locations, setLocations] = useState<SellerLocation[]>([]);
  const [assignments, setAssignments] = useState<
    Record<string, LocationAssignment>
  >({});

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<StaffRole>("associate");
  const [status, setStatus] = useState<StaffStatus>("active");
  const [pinCode, setPinCode] = useState("");

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [removing, setRemoving] = useState(false);

  // ── Toast helper ────────────────────────────────────────────────
  const showToast = useCallback(
    (type: "success" | "error", message: string) => {
      setToast({ type, message });
      setTimeout(() => setToast(null), 4000);
    },
    []
  );

  // ── Get seller id ───────────────────────────────────────────────
  const getSellerId = useCallback(async (): Promise<string | null> => {
    if (staffSellerId) return staffSellerId;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_uid", userData.user.id)
      .maybeSingle();
    if (!profile) return null;
    const { data: seller } = await supabase
      .from("sellers")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("status", "approved")
      .maybeSingle();
    return seller?.id ?? null;
  }, [staffSellerId]);

  // ── Load data ───────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);

      const sellerId = await getSellerId();
      if (!sellerId) {
        showToast("error", "Could not identify seller account.");
        setLoading(false);
        return;
      }

      // Fetch staff record
      const { data: staffData, error: staffErr } = await supabase
        .from("seller_staff")
        .select("*")
        .eq("id", staffId)
        .eq("seller_id", sellerId)
        .maybeSingle();

      if (staffErr || !staffData) {
        showToast("error", staffErr?.message || "Staff member not found.");
        setLoading(false);
        return;
      }

      setStaff(staffData);
      setName(staffData.name);
      setEmail(staffData.email);
      setPhone(staffData.phone || "");
      setRole(staffData.role);
      setStatus(staffData.status);
      setPinCode(staffData.pin_code || "");

      // Fetch all seller locations
      const { data: locs } = await supabase
        .from("seller_locations")
        .select("id, name, type, is_active")
        .eq("seller_id", sellerId)
        .order("name");

      setLocations(locs ?? []);

      // Fetch existing assignments
      const { data: assigns } = await supabase
        .from("staff_location_assignments")
        .select("location_id, permissions")
        .eq("staff_id", staffId);

      const assignMap: Record<string, LocationAssignment> = {};
      (assigns ?? []).forEach((a: { location_id: string; permissions: string[] }) => {
        assignMap[a.location_id] = {
          location_id: a.location_id,
          permissions: a.permissions,
        };
      });
      setAssignments(assignMap);

      setLoading(false);
    })();
  }, [staffId, getSellerId, showToast]);

  // ── Toggle location assignment ──────────────────────────────────
  const toggleLocation = (locationId: string) => {
    setAssignments((prev) => {
      const copy = { ...prev };
      if (copy[locationId]) {
        delete copy[locationId];
      } else {
        copy[locationId] = {
          location_id: locationId,
          permissions: getDefaultPermissions(role),
        };
      }
      return copy;
    });
  };

  // ── Toggle individual permission ────────────────────────────────
  const togglePermission = (locationId: string, permission: string) => {
    setAssignments((prev) => {
      const copy = { ...prev };
      const existing = copy[locationId];
      if (!existing) return prev;
      const perms = existing.permissions.includes(permission)
        ? existing.permissions.filter((p) => p !== permission)
        : [...existing.permissions, permission];
      copy[locationId] = { ...existing, permissions: perms };
      return copy;
    });
  };

  // ── Save staff info ─────────────────────────────────────────────
  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staff) return;
    setSaving(true);

    const { error } = await supabase
      .from("seller_staff")
      .update({
        name,
        email,
        phone: phone || null,
        role,
        status,
        pin_code: pinCode || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", staff.id);

    if (error) {
      showToast("error", error.message);
    } else {
      showToast("success", "Staff info updated successfully.");
      setStaff((prev) =>
        prev
          ? { ...prev, name, email, phone: phone || null, role, status, pin_code: pinCode || null }
          : prev
      );
    }
    setSaving(false);
  };

  // ── Save location assignments ───────────────────────────────────
  const handleSaveAssignments = async () => {
    if (!staff) return;
    setSavingAssignments(true);

    // Snapshot existing assignments BEFORE deleting so we can restore on failure
    const { data: previousAssignments, error: fetchErr } = await supabase
      .from("staff_location_assignments")
      .select("staff_id, location_id, permissions")
      .eq("staff_id", staff.id);

    if (fetchErr) {
      showToast("error", `Failed to read current assignments: ${fetchErr.message}`);
      setSavingAssignments(false);
      return;
    }

    // Delete all existing assignments for this staff
    const { error: delErr } = await supabase
      .from("staff_location_assignments")
      .delete()
      .eq("staff_id", staff.id);

    if (delErr) {
      showToast("error", delErr.message);
      setSavingAssignments(false);
      return;
    }

    // Insert new assignments — Manager always gets all permissions
    const rows = Object.values(assignments).map((a) => ({
      staff_id: staff.id,
      location_id: a.location_id,
      permissions: role === "manager" ? [...ALL_PERMISSION_KEYS] : a.permissions,
    }));

    if (rows.length > 0) {
      const { error: insErr } = await supabase
        .from("staff_location_assignments")
        .insert(rows);

      if (insErr) {
        // Insert failed after delete -- attempt to restore previous assignments
        if (previousAssignments && previousAssignments.length > 0) {
          const { error: restoreErr } = await supabase
            .from("staff_location_assignments")
            .insert(previousAssignments);

          if (restoreErr) {
            showToast(
              "error",
              `Save failed and could not restore previous assignments: ${insErr.message}. Please reload the page and reassign locations.`
            );
          } else {
            showToast(
              "error",
              `Failed to save new assignments: ${insErr.message}. Previous assignments have been restored.`
            );
            // Revert local state to match restored data
            const restoredMap: Record<string, LocationAssignment> = {};
            previousAssignments.forEach((a: { location_id: string; permissions: string[] }) => {
              restoredMap[a.location_id] = {
                location_id: a.location_id,
                permissions: a.permissions,
              };
            });
            setAssignments(restoredMap);
          }
        } else {
          showToast(
            "error",
            `Failed to save assignments: ${insErr.message}. No previous assignments to restore.`
          );
        }

        setSavingAssignments(false);
        return;
      }
    }

    showToast("success", "Location assignments saved.");
    setSavingAssignments(false);
  };

  // ── Deactivate / Remove ─────────────────────────────────────────
  const handleDeactivate = async () => {
    if (!staff) return;
    setDeactivating(true);

    const { error } = await supabase
      .from("seller_staff")
      .update({ status: "inactive", updated_at: new Date().toISOString() })
      .eq("id", staff.id);

    if (error) {
      showToast("error", error.message);
    } else {
      showToast("success", "Staff member deactivated.");
      setStatus("inactive");
      setStaff((prev) => (prev ? { ...prev, status: "inactive" } : prev));
    }
    setDeactivating(false);
  };

  const handleRemove = async () => {
    if (!staff) return;
    setRemoving(true);

    const { error } = await supabase
      .from("seller_staff")
      .update({ status: "removed", updated_at: new Date().toISOString() })
      .eq("id", staff.id);

    if (error) {
      showToast("error", error.message);
    } else {
      showToast("success", "Staff member removed.");
      setStatus("removed");
      setStaff((prev) => (prev ? { ...prev, status: "removed" } : prev));
      setConfirmRemove(false);
    }
    setRemoving(false);
  };

  // ── Role gate: only owners and admins may edit staff ────────────
  const canEditStaff = isOwner || staffRole === "admin";

  if (!staffLoading && !canEditStaff) {
    return (
      <div className="space-y-4">
        <Link
          href="/seller/settings/staff"
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Staff
        </Link>
        <div className="rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <p className="text-red-600 font-medium">Access Denied</p>
          <p className="mt-1 text-sm text-gray-500">
            Only store owners and admins can edit staff members.
          </p>
        </div>
      </div>
    );
  }

  // ── Loading state ───────────────────────────────────────────────
  if (loading || staffLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="space-y-4">
        <Link
          href="/seller/settings/staff"
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Staff
        </Link>
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-gray-500">Staff member not found.</p>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg border px-4 py-3 text-sm shadow-lg ${
            toast.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Back link + Title */}
      <div>
        <Link
          href="/seller/settings/staff"
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Staff
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Edit Staff Member
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Update details, role, and location access for{" "}
          <span className="font-medium text-gray-700">{staff.name}</span>.
        </p>
      </div>

      {/* ── Staff Info Card ─────────────────────────────────────── */}
      <form
        onSubmit={handleSaveInfo}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"
      >
        <h2 className="text-sm font-semibold text-gray-900 mb-4">
          Staff Information
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
            />
          </div>

          {/* PIN Code */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              PIN Code
              <span className="ml-1 text-gray-400 font-normal">
                (for POS login)
              </span>
            </label>
            <input
              type="text"
              value={pinCode}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setPinCode(v);
              }}
              placeholder="4-6 digits"
              maxLength={6}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono tracking-widest focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none bg-white"
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="associate">Associate</option>
            </select>
            <p className="mt-1 text-xs text-gray-400">
              {role === "admin"
                ? "Full access to all features at all locations"
                : role === "manager"
                ? "Full access at assigned locations only"
                : "Limited access — only assigned permissions at assigned locations"}
            </p>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StaffStatus)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none bg-white"
            >
              <option value="invited">Invited (Pending)</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="removed">Removed</option>
            </select>
          </div>
        </div>

        <div className="mt-5">
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-500 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>

      {/* ── Location Assignments Card ───────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Location Assignments
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {role === "admin"
                ? "Admins have automatic access to all locations."
                : role === "manager"
                ? "Select which locations this manager can access."
                : "Toggle locations and configure permissions for each."}
            </p>
          </div>
          {role !== "admin" && (
            <button
              type="button"
              onClick={handleSaveAssignments}
              disabled={savingAssignments}
              className="bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
            >
              {savingAssignments ? "Saving..." : "Save Assignments"}
            </button>
          )}
        </div>

        {role === "admin" ? (
          <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-purple-800">Access to all locations</p>
                <p className="text-xs text-purple-600 mt-0.5">
                  Admins automatically have full access to all current and future locations with all permissions. No assignment needed.
                </p>
              </div>
            </div>
          </div>
        ) : locations.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            No locations found. Add locations first.
          </p>
        ) : (
          <div className="space-y-3">
            {locations.map((loc) => {
              const isAssigned = !!assignments[loc.id];
              const perms = assignments[loc.id]?.permissions ?? [];

              return (
                <div
                  key={loc.id}
                  className={`rounded-lg border p-4 transition-colors ${
                    isAssigned
                      ? "border-indigo-200 bg-indigo-50/30"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  {/* Location header + toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {loc.name}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">
                          {loc.type.replace("_", " ")}
                          {!loc.is_active && (
                            <span className="ml-1.5 text-amber-600">
                              (inactive)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Toggle switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isAssigned}
                      onClick={() => toggleLocation(loc.id)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        isAssigned ? "bg-indigo-500" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                          isAssigned ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Permission checkboxes (shown when assigned) */}
                  {isAssigned && (
                    role === "associate" ? (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {ALL_PERMISSIONS.map((perm) => (
                          <label
                            key={perm.key}
                            className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={perms.includes(perm.key)}
                              onChange={() =>
                                togglePermission(loc.id, perm.key)
                              }
                              className="h-4 w-4 rounded border-gray-300 text-indigo-500 focus:ring-indigo-400"
                            />
                            {perm.label}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 flex items-center gap-1.5">
                        <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm text-green-600 font-medium">
                          Full access to all features at this location
                        </span>
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Activity Card ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Activity</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-xs font-medium text-gray-500">Invited at</dt>
            <dd className="mt-1 text-gray-900">
              {formatDate(staff.invited_at)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Activated at</dt>
            <dd className="mt-1 text-gray-900">
              {formatDate(staff.activated_at)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Last login</dt>
            <dd className="mt-1 text-gray-900">
              {formatDate(staff.last_login_at)}
            </dd>
          </div>
        </dl>
      </div>

      {/* ── Danger Zone Card ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-red-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-red-600 mb-2">
          Danger Zone
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          These actions affect the staff member&apos;s access to your store.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {/* Deactivate */}
          {staff.status !== "inactive" && staff.status !== "removed" && (
            <button
              type="button"
              onClick={handleDeactivate}
              disabled={deactivating}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {deactivating ? "Deactivating..." : "Deactivate Staff"}
            </button>
          )}

          {/* Remove */}
          {staff.status !== "removed" && !confirmRemove && (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Remove Staff
            </button>
          )}

          {/* Remove confirmation */}
          {confirmRemove && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2">
              <span className="text-sm text-red-700">
                Are you sure? This will revoke all access.
              </span>
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {removing ? "Removing..." : "Yes, Remove"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmRemove(false)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
