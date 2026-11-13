"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/src/lib/supabase/client";
import Link from "next/link";
import { useStaff } from "@/src/context/StaffContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StaffMember {
  id: string;
  seller_id: string;
  profile_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  role: "admin" | "manager" | "associate";
  status: "invited" | "active" | "inactive" | "removed";
  pin_code: string | null;
  invite_token: string | null;
  invite_expires_at: string | null;
  invited_at: string | null;
  activated_at: string | null;
  last_login_at: string | null;
  created_at: string;
}

interface LocationAssignment {
  id: string;
  staff_id: string;
  location_id: string;
  permissions: string[];
  created_at: string;
}

interface SellerLocation {
  id: string;
  seller_id: string;
  name: string;
  type: string;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_PERMISSIONS = [
  { key: "inventory_view", label: "View Inventory" },
  { key: "inventory_edit", label: "Edit Inventory" },
  { key: "transfers_create", label: "Create Transfers" },
  { key: "transfers_manage", label: "Manage Transfers" },
  { key: "orders_view", label: "View Orders" },
  { key: "orders_fulfill", label: "Fulfill Orders" },
] as const;

const ROLE_OPTIONS: { value: StaffMember["role"]; label: string; description: string }[] = [
  { value: "admin", label: "Admin", description: "Full access to all features at all locations" },
  { value: "manager", label: "Manager", description: "Full access at assigned locations only" },
  { value: "associate", label: "Associate", description: "Limited access — only assigned permissions at assigned locations" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roleBadge(role: StaffMember["role"]) {
  const map: Record<string, string> = {
    admin: "bg-purple-100 text-purple-700",
    manager: "bg-blue-100 text-blue-700",
    associate: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${map[role] ?? "bg-gray-100 text-gray-700"}`}
    >
      {role}
    </span>
  );
}

function statusBadge(status: StaffMember["status"]) {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    invited: "bg-yellow-100 text-yellow-700",
    inactive: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${map[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {status === "invited" ? "Pending" : status}
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StaffListContent() {
  const { sellerId: staffSellerId } = useStaff();

  // Data
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [assignments, setAssignments] = useState<LocationAssignment[]>([]);
  const [locations, setLocations] = useState<SellerLocation[]>([]);

  // UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [inviteLinkModal, setInviteLinkModal] = useState<{ name: string; url: string; emailSent: boolean } | null>(null);

  // ------ Data loading ------

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Current user -> profile -> seller
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setError("You must be signed in.");
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_uid", userData.user.id)
        .maybeSingle();

      if (!profile) {
        setError("Profile not found.");
        setLoading(false);
        return;
      }

      let resolvedSellerId = staffSellerId;
      if (!resolvedSellerId) {
        const { data: seller } = await supabase
          .from("sellers")
          .select("id")
          .eq("profile_id", profile.id)
          .maybeSingle();
        resolvedSellerId = seller?.id ?? null;
      }

      if (!resolvedSellerId) {
        setError("Seller account not found.");
        setLoading(false);
        return;
      }

      setSellerId(resolvedSellerId);

      // 2. Fetch staff (exclude removed)
      const { data: staffRows, error: staffErr } = await supabase
        .from("seller_staff")
        .select("*")
        .eq("seller_id", resolvedSellerId)
        .neq("status", "removed")
        .order("created_at", { ascending: false });

      if (staffErr) throw staffErr;
      setStaff((staffRows as StaffMember[]) ?? []);

      // 3. Fetch location assignments for those staff
      const staffIds = (staffRows ?? []).map((s: StaffMember) => s.id);
      if (staffIds.length > 0) {
        const { data: assignRows, error: assignErr } = await supabase
          .from("staff_location_assignments")
          .select("*")
          .in("staff_id", staffIds);

        if (assignErr) throw assignErr;
        setAssignments((assignRows as LocationAssignment[]) ?? []);
      } else {
        setAssignments([]);
      }

      // 4. Fetch seller locations
      const { data: locRows, error: locErr } = await supabase
        .from("seller_locations")
        .select("*")
        .eq("seller_id", resolvedSellerId)
        .eq("is_active", true)
        .order("name");

      if (locErr) throw locErr;
      setLocations((locRows as SellerLocation[]) ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load staff data.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [staffSellerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ------ Derived stats ------

  const totalCount = staff.length;
  const activeCount = staff.filter((s) => s.status === "active").length;
  const invitedCount = staff.filter((s) => s.status === "invited").length;

  // Map location id -> name for quick lookup
  const locationMap = new Map(locations.map((l) => [l.id, l.name]));

  function locationNamesForStaff(member: StaffMember): string {
    // Admin has access to all locations
    if (member.role === "admin") return "All locations";
    const ids = assignments
      .filter((a) => a.staff_id === member.id)
      .map((a) => a.location_id);
    const names = ids.map((id) => locationMap.get(id)).filter(Boolean);
    return names.length > 0 ? names.join(", ") : "\u2014";
  }

  // ------ Invite link actions ------

  // Generate a random token client-side (crypto.randomUUID is available in all modern browsers)
  function generateToken() {
    return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  }

  function copyToClipboard(text: string): Promise<void> {
    if (navigator.clipboard && document.hasFocus()) {
      return navigator.clipboard.writeText(text);
    }
    // Fallback for unfocused documents / iframes
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand("copy"); } catch { /* ignore */ }
    document.body.removeChild(ta);
    return Promise.resolve();
  }

  async function handleCopyInviteLink(member: StaffMember) {
    if (member.invite_token) {
      const url = `${window.location.origin}/invite/${member.invite_token}`;
      await copyToClipboard(url);
      setCopiedId(member.id);
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      // Generate token client-side and update the record directly
      await handleGenerateToken(member, true);
    }
  }

  async function handleGenerateToken(member: StaffMember, copyOnly = false) {
    if (!sellerId) return;
    setResendingId(member.id);

    try {
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error: updateErr } = await supabase
        .from("seller_staff")
        .update({
          invite_token: token,
          invite_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", member.id)
        .eq("seller_id", sellerId);

      if (updateErr) {
        alert("Failed to generate invite token: " + updateErr.message);
        return;
      }

      const inviteUrl = `${window.location.origin}/invite/${token}`;

      if (copyOnly) {
        await copyToClipboard(inviteUrl);
        setCopiedId(member.id);
        setTimeout(() => setCopiedId(null), 2000);
      } else {
        setInviteLinkModal({
          name: member.name,
          url: inviteUrl,
          emailSent: false,
        });
      }

      loadData();
    } catch {
      alert("Failed to generate invite link.");
    } finally {
      setResendingId(null);
    }
  }

  // ------ Render ------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Staff &amp; Permissions
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your team members and their access levels.
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
        >
          Invite Staff
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Staff", value: totalCount },
          { label: "Active", value: activeCount },
          { label: "Invited (Pending)", value: invitedCount },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4"
          >
            <p className="text-xs font-medium text-gray-500">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Staff list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {staff.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            No staff members yet. Click &ldquo;Invite Staff&rdquo; to add your first team member.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name &amp; Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Locations
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staff.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {member.name}
                      </div>
                      <div className="text-gray-500 text-xs">{member.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {roleBadge(member.role)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {statusBadge(member.status)}
                    </td>
                    <td className="px-6 py-4 text-gray-700 max-w-[200px] truncate">
                      {locationNamesForStaff(member)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {formatDate(member.last_login_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                      {member.status === "invited" && (
                        <>
                          <button
                            onClick={() => handleCopyInviteLink(member)}
                            className="text-teal-600 hover:text-teal-800 text-sm font-medium"
                          >
                            {copiedId === member.id ? "Copied!" : "Copy Link"}
                          </button>
                          <button
                            onClick={() => handleGenerateToken(member)}
                            disabled={resendingId === member.id}
                            className="text-amber-600 hover:text-amber-800 text-sm font-medium disabled:opacity-50"
                          >
                            {resendingId === member.id ? "Sending..." : "Resend"}
                          </button>
                        </>
                      )}
                      <Link
                        href={`/seller/settings/staff/${member.id}`}
                        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite modal */}
      {showInviteModal && sellerId && (
        <InviteStaffModal
          sellerId={sellerId}
          locations={locations}
          onClose={() => setShowInviteModal(false)}
          onSuccess={(inviteInfo) => {
            setShowInviteModal(false);
            loadData();
            if (inviteInfo) {
              setInviteLinkModal(inviteInfo);
            }
          }}
        />
      )}

      {/* Invite link modal */}
      {inviteLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setInviteLinkModal(null)}
          />
          <div className="relative bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md mx-4 p-6">
            <div className="text-center mb-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-3">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Invite Sent to {inviteLinkModal.name}
              </h3>
              {inviteLinkModal.emailSent ? (
                <p className="mt-1 text-sm text-gray-500">
                  An invitation email has been sent. They can also use the link below.
                </p>
              ) : (
                <p className="mt-1 text-sm text-gray-500">
                  Share this link with them to accept the invite. The link expires in 7 days.
                </p>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Invite Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteLinkModal.url}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 truncate outline-none"
                />
                <button
                  onClick={async () => {
                    await copyToClipboard(inviteLinkModal.url);
                    const btn = document.getElementById("copy-invite-btn");
                    if (btn) btn.textContent = "Copied!";
                    setTimeout(() => {
                      if (btn) btn.textContent = "Copy";
                    }, 2000);
                  }}
                  id="copy-invite-btn"
                  className="shrink-0 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-600 transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>

            <button
              onClick={() => setInviteLinkModal(null)}
              className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invite Staff Modal
// ---------------------------------------------------------------------------

interface InviteModalProps {
  sellerId: string;
  locations: SellerLocation[];
  onClose: () => void;
  onSuccess: (inviteInfo?: { name: string; url: string; emailSent: boolean }) => void;
}

function InviteStaffModal({ sellerId, locations, onClose, onSuccess }: InviteModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<StaffMember["role"]>("associate");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Location assignments: { [locationId]: string[] (selected permissions) }
  const [locPerms, setLocPerms] = useState<Record<string, string[]>>({});

  function toggleLocation(locationId: string) {
    setLocPerms((prev) => {
      const copy = { ...prev };
      if (copy[locationId]) {
        delete copy[locationId];
      } else {
        copy[locationId] = [];
      }
      return copy;
    });
  }

  function togglePermission(locationId: string, perm: string) {
    setLocPerms((prev) => {
      const current = prev[locationId] ?? [];
      const next = current.includes(perm)
        ? current.filter((p) => p !== perm)
        : [...current, perm];
      return { ...prev, [locationId]: next };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!name.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (!email.trim()) {
      setFormError("Email is required.");
      return;
    }

    setSubmitting(true);

    try {
      // 1. Insert staff member
      const { data: newStaff, error: staffErr } = await supabase
        .from("seller_staff")
        .insert({
          seller_id: sellerId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          role,
          status: "invited",
          invited_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (staffErr) throw staffErr;
      if (!newStaff) throw new Error("Failed to create staff record.");

      // 2. Insert location assignments (Admin skips — they get all locations via code)
      if (role !== "admin") {
        const assignedLocationIds = Object.keys(locPerms);
        const allPermKeys = ALL_PERMISSIONS.map((p) => p.key);
        if (assignedLocationIds.length > 0) {
          const rows = assignedLocationIds.map((locationId) => ({
            staff_id: newStaff.id,
            location_id: locationId,
            // Manager gets all permissions; Associate gets only selected ones
            permissions: role === "associate" ? (locPerms[locationId] ?? []) : allPermKeys,
          }));

          const { error: assignErr } = await supabase
            .from("staff_location_assignments")
            .insert(rows);

          if (assignErr) throw assignErr;
        }
      }

      // 3. Generate invite token client-side
      const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error: tokenErr } = await supabase
        .from("seller_staff")
        .update({
          invite_token: token,
          invite_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", newStaff.id);

      const inviteUrl = `${window.location.origin}/invite/${token}`;

      if (tokenErr) {
        // Staff was created but token failed — still show success, user can copy link later
        onSuccess();
      } else {
        onSuccess({
          name: name.trim(),
          url: inviteUrl,
          emailSent: false,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to invite staff member.";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Invite Staff Member
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Send an invitation to join your team.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@example.com"
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
              placeholder="+91 98765 43210"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Role <span className="text-red-500">*</span>
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffMember["role"])}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none bg-white"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              {ROLE_OPTIONS.find((o) => o.value === role)?.description}
            </p>
          </div>

          {/* Location assignments — Admin gets all locations automatically */}
          {role === "admin" ? (
            <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-purple-800">Access to all locations</p>
                  <p className="text-xs text-purple-600 mt-0.5">
                    Admins automatically have full access to all current and future locations with all permissions.
                  </p>
                </div>
              </div>
            </div>
          ) : locations.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Location Assignments
              </label>
              <p className="text-xs text-gray-400 mb-2">
                {role === "manager"
                  ? "Select which locations this manager can access. They\u2019ll have full permissions at each."
                  : "Select locations and configure specific permissions for this associate."}
              </p>
              <div className="space-y-3">
                {locations.map((loc) => {
                  const isSelected = locPerms[loc.id] !== undefined;
                  return (
                    <div
                      key={loc.id}
                      className={`rounded-lg border p-3 transition-colors ${
                        isSelected
                          ? "border-indigo-300 bg-indigo-50/40"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleLocation(loc.id)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-gray-800">
                          {loc.name}
                        </span>
                        <span className="text-xs text-gray-400 capitalize">
                          ({loc.type})
                        </span>
                      </label>

                      {/* Permissions for this location */}
                      {isSelected && (
                        role === "associate" ? (
                          <div className="mt-2 ml-6 grid grid-cols-2 gap-x-4 gap-y-1">
                            {ALL_PERMISSIONS.map((perm) => (
                              <label
                                key={perm.key}
                                className="flex items-center gap-1.5 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    locPerms[loc.id]?.includes(perm.key) ?? false
                                  }
                                  onChange={() =>
                                    togglePermission(loc.id, perm.key)
                                  }
                                  className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-xs text-gray-600">
                                  {perm.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-2 ml-6 flex items-center gap-1.5">
                            <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xs text-green-600 font-medium">
                              Full access to all features at this location
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Sending Invite..." : "Send Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
