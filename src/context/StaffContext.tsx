"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { supabase } from "@/src/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StaffContextValue {
  isStaff: boolean;
  isOwner: boolean;
  staffRole: "admin" | "manager" | "associate" | null;
  staffId: string | null;
  sellerId: string | null;
  assignedLocationIds: string[];
  permissions: Map<string, string[]>; // locationId -> permissions[]
  loading: boolean;
  hasPermission: (locationId: string, permission: string) => boolean;
  hasAnyPermission: (permission: string) => boolean;
  canAccessLocation: (locationId: string) => boolean;
}

// ---------------------------------------------------------------------------
// Defaults (safe initial state while loading)
// ---------------------------------------------------------------------------

const defaultValue: StaffContextValue = {
  isStaff: false,
  isOwner: false,
  staffRole: null,
  staffId: null,
  sellerId: null,
  assignedLocationIds: [],
  permissions: new Map(),
  loading: true,
  hasPermission: () => false,
  hasAnyPermission: () => false,
  canAccessLocation: () => false,
};

const StaffContext = createContext<StaffContextValue>(defaultValue);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function StaffProvider({ children }: { children: React.ReactNode }) {
  const [isStaff, setIsStaff] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [staffRole, setStaffRole] = useState<
    "admin" | "manager" | "associate" | null
  >(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [assignedLocationIds, setAssignedLocationIds] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<Map<string, string[]>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);

  // -----------------------------------------------------------------------
  // Permission helpers (stable references via useCallback + deps)
  // -----------------------------------------------------------------------

  const hasPermission = useCallback(
    (locationId: string, permission: string): boolean => {
      // Owner has all permissions everywhere
      if (isOwner) return true;

      if (!isStaff) return false;

      // Admin: all permissions at ALL locations (like a co-owner)
      if (staffRole === "admin") return true;

      // Manager: all permissions but only at assigned locations
      if (staffRole === "manager") {
        return assignedLocationIds.includes(locationId);
      }

      // Associate: check explicit permission at this location
      const locationPerms = permissions.get(locationId);
      return locationPerms ? locationPerms.includes(permission) : false;
    },
    [isOwner, isStaff, staffRole, assignedLocationIds, permissions]
  );

  const hasAnyPermission = useCallback(
    (permission: string): boolean => {
      // Owner always has every permission
      if (isOwner) return true;

      if (!isStaff) return false;

      // Admin: always has every permission (all locations)
      if (staffRole === "admin") return true;

      // Manager: true if they have at least one assigned location
      if (staffRole === "manager") {
        return assignedLocationIds.length > 0;
      }

      // Associate: check if any location grants this permission
      for (const perms of permissions.values()) {
        if (perms.includes(permission)) return true;
      }
      return false;
    },
    [isOwner, isStaff, staffRole, assignedLocationIds, permissions]
  );

  const canAccessLocation = useCallback(
    (locationId: string): boolean => {
      if (isOwner) return true;
      if (!isStaff) return false;
      // Admin can access ALL locations
      if (staffRole === "admin") return true;
      // Manager/Associate: only assigned locations
      return assignedLocationIds.includes(locationId);
    },
    [isOwner, isStaff, staffRole, assignedLocationIds]
  );

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    function applyRoleData(roleData: Record<string, unknown>) {
      if (cancelled) return;

      if (roleData.role === "staff") {
          const role = roleData.staffRole as "admin" | "manager" | "associate";
          const locIds: string[] = [];
          const permsMap = new Map<string, string[]>();

          if (roleData.locationAssignments) {
            for (const a of roleData.locationAssignments as { location_id: string; permissions: string[] }[]) {
              locIds.push(a.location_id);
              permsMap.set(
                a.location_id,
                Array.isArray(a.permissions) ? a.permissions : []
              );
            }
          }

          setIsStaff(true);
          setIsOwner(false);
          setStaffRole(role);
          setStaffId(roleData.staffId as string);
          setSellerId(roleData.sellerId as string);
          setAssignedLocationIds(locIds);
          setPermissions(permsMap);
          setLoading(false);
          return;
        }

      if (roleData.role === "seller") {
        setIsOwner(true);
        setIsStaff(false);
        setStaffRole(null);
        setStaffId(null);
        setSellerId(roleData.sellerId as string);
        setAssignedLocationIds([]);
        setPermissions(new Map());
        setLoading(false);
        return;
      }

      // Admin or customer — just set loading false
      if (!cancelled) setLoading(false);
    }

    async function fetchAndApply() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token || cancelled) {
        if (!cancelled) setLoading(false);
        return;
      }
      const res = await fetch("/api/auth/detect-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) {
        if (!cancelled) setLoading(false);
        return;
      }
      const roleData = await res.json();
      try {
        sessionStorage.setItem("shopora_role_cache", JSON.stringify({
          ...roleData,
          cachedAt: Date.now(),
        }));
      } catch { /* ignore */ }
      applyRoleData(roleData);
    }

    async function load() {
      try {
        // 1. Try cache first — instant, no network round-trip
        try {
          const raw = sessionStorage.getItem("shopora_role_cache");
          if (raw) {
            const cache = JSON.parse(raw);
            if (Date.now() - cache.cachedAt < 5 * 60 * 1000) {
              applyRoleData(cache);
              // Re-validate in background
              fetchAndApply();
              return;
            }
          }
        } catch { /* ignore */ }

        // 2. No cache — fetch from API
        await fetchAndApply();
      } catch (err) {
        console.error("StaffContext load error:", err);
        if (!cancelled) setLoading(false);
      }
    }

    load();

    // Re-run when auth state changes (sign-in / sign-out)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      if (!cancelled) {
        setLoading(true);
        load();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // -----------------------------------------------------------------------
  // Memoised context value
  // -----------------------------------------------------------------------

  const value = useMemo<StaffContextValue>(
    () => ({
      isStaff,
      isOwner,
      staffRole,
      staffId,
      sellerId,
      assignedLocationIds,
      permissions,
      loading,
      hasPermission,
      hasAnyPermission,
      canAccessLocation,
    }),
    [
      isStaff,
      isOwner,
      staffRole,
      staffId,
      sellerId,
      assignedLocationIds,
      permissions,
      loading,
      hasPermission,
      hasAnyPermission,
      canAccessLocation,
    ]
  );

  return (
    <StaffContext.Provider value={value}>{children}</StaffContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStaff(): StaffContextValue {
  const ctx = useContext(StaffContext);
  if (ctx === undefined) {
    throw new Error("useStaff must be used within a <StaffProvider>");
  }
  return ctx;
}
