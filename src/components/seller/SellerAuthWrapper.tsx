"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase/client";
import SellerLayout from "@/src/components/seller/SellerLayout";
import Spinner from "@/src/components/Spinner";
import { StaffProvider } from "@/src/context/StaffContext";
import StaffRouteGuard from "@/src/components/seller/StaffRouteGuard";

// Routes that don't require seller auth (rendered without sidebar)
const PUBLIC_SELLER_ROUTES = ["/seller/register", "/seller/staff-invite"];

// Cache TTL: 5 minutes — avoids re-fetching on every page navigation
const ROLE_CACHE_TTL = 5 * 60 * 1000;

interface RoleCache {
  role: string;
  sellerName?: string;
  sellerId?: string;
  staffRole?: string;
  staffId?: string;
  cachedAt: number;
}

function getRoleCache(): RoleCache | null {
  try {
    const raw = sessionStorage.getItem("shopora_role_cache");
    if (!raw) return null;
    const cache: RoleCache = JSON.parse(raw);
    if (Date.now() - cache.cachedAt > ROLE_CACHE_TTL) {
      sessionStorage.removeItem("shopora_role_cache");
      return null;
    }
    return cache;
  } catch {
    return null;
  }
}

function setRoleCache(data: Record<string, unknown>) {
  try {
    sessionStorage.setItem("shopora_role_cache", JSON.stringify({
      ...data,
      cachedAt: Date.now(),
    }));
  } catch { /* ignore */ }
}

async function fetchRoleData(accessToken: string): Promise<Record<string, unknown> | null> {
  const res = await fetch("/api/auth/detect-role", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) return null;
  return res.json();
}

export default function SellerAuthWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [authState, setAuthState] = useState<"loading" | "authorized" | "unauthorized">("loading");
  const [sellerName, setSellerName] = useState("Shopora Seller");
  const [sellerInitials, setSellerInitials] = useState("S");
  const checkedRef = useRef(false);

  const isPublicRoute = PUBLIC_SELLER_ROUTES.some(
    (route) => pathname === route || pathname?.startsWith(route + "/")
  );

  useEffect(() => {
    if (isPublicRoute) {
      setAuthState("authorized");
      return;
    }

    let active = true;

    const applyRole = (roleData: Record<string, unknown>) => {
      if (!active) return false;

      const role = roleData.role as string;
      const bizName = (roleData.sellerName as string) || "Shopora Seller";

      if (role === "seller" || role === "staff") {
        setSellerName(bizName);
        const initials = bizName.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase();
        setSellerInitials(initials || "S");
        setAuthState("authorized");
        return true;
      }

      if (role === "admin") {
        setSellerName("Admin");
        setSellerInitials("A");
        setAuthState("authorized");
        return true;
      }

      if (role === "seller_pending") {
        router.replace("/seller/register");
        return true;
      }

      // Not authorized for seller routes
      router.replace("/");
      return true;
    };

    const checkAuth = async () => {
      // 1. Try cache first (instant, no network)
      const cache = getRoleCache();
      if (cache && (cache.role === "seller" || cache.role === "staff" || cache.role === "admin")) {
        applyRole(cache as unknown as Record<string, unknown>);
        checkedRef.current = true;
        // Re-validate in background (don't block UI)
        revalidateInBackground();
        return;
      }

      // 2. Get session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        if (active) router.replace(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }

      // 3. Fetch role from API
      try {
        const roleData = await fetchRoleData(session.access_token);
        if (!active) return;
        if (roleData) {
          setRoleCache(roleData);
          applyRole(roleData);
        } else {
          router.replace(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
        }
      } catch {
        if (active) router.replace(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
      }
    };

    const revalidateInBackground = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token || !active) return;
      try {
        const roleData = await fetchRoleData(session.access_token);
        if (roleData && active) {
          // Only update cache/state if the new role is still authorized
          // Don't downgrade from staff/seller to customer due to a transient error
          const newRole = roleData.role as string;
          if (newRole === "seller" || newRole === "staff" || newRole === "admin") {
            setRoleCache(roleData);
            applyRole(roleData);
          }
        }
      } catch { /* silent background failure is ok */ }
    };

    void checkAuth();

    return () => { active = false; };
  }, [isPublicRoute, pathname, router]);

  // Public routes render without the seller layout
  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (authState === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Spinner />
      </div>
    );
  }

  if (authState === "unauthorized") {
    return null;
  }

  return (
    <StaffProvider>
      <SellerLayout storeName={sellerName} userInitials={sellerInitials}>
        <StaffRouteGuard>{children}</StaffRouteGuard>
      </SellerLayout>
    </StaffProvider>
  );
}
