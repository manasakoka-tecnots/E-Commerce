"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/src/lib/supabase/client";
import { useStaff } from "@/src/context/StaffContext";

/**
 * Resolves the sellerId for the current user — works for both
 * direct sellers (owner) and staff members.
 *
 * Uses StaffContext as primary source (it already does the work).
 * Falls back to a direct query only if StaffContext hasn't loaded yet.
 */
export function useSellerIdentity() {
  const staff = useStaff();
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If StaffContext is still loading, wait
    if (staff.loading) return;

    // StaffContext resolved — use its sellerId
    if (staff.sellerId) {
      setSellerId(staff.sellerId);
      setLoading(false);
      return;
    }

    // StaffContext has no sellerId — try direct query as final fallback
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) { setLoading(false); return; }

        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("auth_uid", user.id)
          .maybeSingle();
        if (!profile || cancelled) { setLoading(false); return; }

        setProfileId(profile.id);

        const { data: seller } = await supabase
          .from("sellers")
          .select("id")
          .eq("profile_id", profile.id)
          .maybeSingle();

        if (!cancelled) {
          setSellerId(seller?.id ?? null);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [staff.loading, staff.sellerId]);

  return {
    sellerId,
    profileId,
    loading: loading || staff.loading,
    isStaff: staff.isStaff,
    isOwner: staff.isOwner,
    staffRole: staff.staffRole,
    assignedLocationIds: staff.assignedLocationIds,
    hasPermission: staff.hasPermission,
    hasAnyPermission: staff.hasAnyPermission,
    canAccessLocation: staff.canAccessLocation,
  };
}
