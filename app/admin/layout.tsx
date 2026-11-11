"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/src/lib/supabase/client";
import AdminLayout from "@/src/components/admin/AdminLayout";

/* Routes that skip the admin auth check */
const PUBLIC_ROUTES = ["/admin/login"];

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [adminName, setAdminName] = useState("Admin");
  const [adminInitials, setAdminInitials] = useState("A");

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname?.startsWith(route + "/")
  );

  useEffect(() => {
    if (isPublicRoute) {
      setLoading(false);
      setAuthorized(false); // Not relevant, we render children directly
      return;
    }

    let cancelled = false;

    const checkAuth = async () => {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (userError || !user) {
        router.replace("/admin/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, full_name, email")
        .eq("auth_uid", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (profileError || profile?.role !== "admin") {
        router.replace("/admin/login");
        return;
      }

      // Set admin display info
      const name = profile.full_name || profile.email || "Admin";
      setAdminName(name);
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        setAdminInitials(
          (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        );
      } else {
        setAdminInitials(name.charAt(0).toUpperCase());
      }

      setAuthorized(true);
      setLoading(false);
    };

    void checkAuth();

    return () => {
      cancelled = true;
    };
  }, [pathname, isPublicRoute, router]);

  /* Public routes (login) render without the admin layout */
  if (isPublicRoute) {
    return <>{children}</>;
  }

  /* Loading spinner while checking auth */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
          <p className="text-sm text-gray-500">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  /* Not authorized -- will redirect, but show nothing in the meantime */
  if (!authorized) {
    return null;
  }

  /* Authorized admin -- wrap children in the admin layout */
  return (
    <AdminLayout adminName={adminName} adminInitials={adminInitials}>
      {children}
    </AdminLayout>
  );
}
