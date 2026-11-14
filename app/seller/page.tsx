"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase/client";
import SellerLandingPage from "@/src/components/seller/SellerLandingPage";
import Spinner from "@/src/components/Spinner";

export default function SellerPage() {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "guest">("loading");

  useEffect(() => {
    let active = true;

    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;

      if (!session?.access_token) {
        setState("guest");
        return;
      }

      // Check if user has seller/staff/admin role — redirect them to dashboard
      try {
        const cached = sessionStorage.getItem("shopora_role_cache");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.cachedAt < 5 * 60 * 1000) {
            const role = parsed.role;
            if (role === "seller" || role === "staff" || role === "admin") {
              router.replace("/seller/dashboard");
              return;
            }
          }
        }

        const res = await fetch("/api/auth/detect-role", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (!active) return;

        if (res.ok) {
          const data = await res.json();
          const role = data.role as string;
          if (role === "seller" || role === "staff" || role === "admin") {
            router.replace("/seller/dashboard");
            return;
          }
        }
      } catch { /* fall through to guest */ }

      // Not a seller/staff — show landing page (even if logged in as customer)
      setState("guest");
    }

    check();
    return () => { active = false; };
  }, [router]);

  if (state === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Spinner />
      </div>
    );
  }

  return <SellerLandingPage />;
}
