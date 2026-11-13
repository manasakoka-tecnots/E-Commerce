"use client";

import { usePathname, useRouter } from "next/navigation";
import { useStaff } from "@/src/context/StaffContext";
import { useEffect, useState } from "react";

/**
 * Route-level access control for staff members.
 * Uses permission-based checks (Shopify-style) instead of hardcoded role→route mappings.
 *
 * Owner and admin staff see everything.
 * Manager and associate staff are restricted based on their assigned permissions.
 */

// Routes that are always allowed (public seller routes)
const ALWAYS_ALLOWED = [
  "/seller/register",
  "/seller/staff-invite",
  "/seller/pending",
];

// Map route prefixes to the permission(s) needed (any one of them grants access)
const ROUTE_PERMISSION_MAP: [string, string[]][] = [
  // Dashboard — always allowed for staff
  ["/seller", []],
  // Orders — needs orders_view
  ["/seller/orders", ["orders_view"]],
  // Products — always allowed (basic product browsing)
  ["/seller/products", []],
  // Inventory — needs inventory_view
  ["/seller/products/inventory", ["inventory_view"]],
  // Transfers — needs transfers_create or transfers_manage
  ["/seller/transfers", ["transfers_create", "transfers_manage"]],
  // Locations — managers and above (handled separately)
  ["/seller/locations", ["locations_manage"]],
  // Customers — managers and above
  ["/seller/customers", []],
  // Settings — owner/admin only (handled separately)
  ["/seller/settings", []],
];

export default function StaffRouteGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isStaff, isOwner, staffRole, hasAnyPermission, loading } = useStaff();
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    if (loading || !pathname) return;

    // Always-allowed routes
    if (ALWAYS_ALLOWED.some(r => pathname === r || pathname.startsWith(r + "/"))) {
      setAllowed(true);
      return;
    }

    // Owner or non-staff → allow everything
    if (isOwner || !isStaff) {
      setAllowed(true);
      return;
    }

    // Admin staff → allow everything
    if (staffRole === "admin") {
      setAllowed(true);
      return;
    }

    // Settings — owner and admin only
    if (pathname.startsWith("/seller/settings")) {
      setAllowed(false);
      router.replace("/seller");
      return;
    }

    // Locations/Customers — manager and above
    if (pathname.startsWith("/seller/locations") || pathname.startsWith("/seller/customers")) {
      if (staffRole === "manager") {
        setAllowed(true);
      } else {
        setAllowed(false);
        router.replace("/seller");
      }
      return;
    }

    // Find the most specific matching route and check permissions
    // Sort by specificity (longer prefix = more specific)
    const sortedRoutes = [...ROUTE_PERMISSION_MAP].sort(
      (a, b) => b[0].length - a[0].length
    );

    for (const [prefix, requiredPerms] of sortedRoutes) {
      if (pathname === prefix || pathname.startsWith(prefix + "/")) {
        // No permission required — allow
        if (requiredPerms.length === 0) {
          setAllowed(true);
          return;
        }
        // Check if staff has any of the required permissions
        const hasAccess = requiredPerms.some(p => hasAnyPermission(p));
        if (hasAccess) {
          setAllowed(true);
        } else {
          setAllowed(false);
          router.replace("/seller");
        }
        return;
      }
    }

    // Routes not in the map (finances, analytics, marketing, etc.) — block staff
    setAllowed(false);
    router.replace("/seller");
  }, [loading, pathname, isStaff, isOwner, staffRole, hasAnyPermission, router]);

  if (loading) return null;

  if (!allowed) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">Access Denied</h2>
          <p className="mt-1 text-sm text-gray-500">
            You don&apos;t have permission to access this page.
          </p>
          <p className="mt-1 text-xs text-gray-400">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
