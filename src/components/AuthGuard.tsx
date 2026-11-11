// src/components/AuthGuard.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase/client";

/**
 * Simple client‑side guard that redirects unauthenticated users to the login page.
 * Wrap any page component inside <AuthGuard>...</AuthGuard>.
 */
export default function AuthGuard({
  children,
  redirectTo = "/auth/login",
}: {
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.replace(redirectTo);
      } else {
        setLoading(false);
      }
    };
    checkAuth();
  }, [redirectTo, router]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading…</div>;
  }

  return <>{children}</>;
}
