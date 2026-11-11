"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase/client";
import SellerLayout from "@/src/components/seller/SellerLayout";
import Spinner from "@/src/components/Spinner";

// Routes that don't require seller auth (rendered without sidebar)
const PUBLIC_SELLER_ROUTES = ["/seller/register"];

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

  const isPublicRoute = PUBLIC_SELLER_ROUTES.some(
    (route) => pathname === route || pathname?.startsWith(route + "/")
  );

  useEffect(() => {
    if (isPublicRoute) {
      setAuthState("authorized");
      return;
    }

    let active = true;

    const checkSellerAuth = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!active) return;

      if (userError || !user) {
        router.replace(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, role, full_name")
        .eq("auth_uid", user.id)
        .maybeSingle();

      if (!active) return;

      if (!profile || (profile.role !== "seller" && profile.role !== "admin")) {
        // Not a seller — redirect to customer homepage
        router.replace("/");
        return;
      }

      const { data: seller } = await supabase
        .from("sellers")
        .select("id, business_name, status")
        .eq("profile_id", profile.id)
        .maybeSingle();

      if (!active) return;

      if (!seller || seller.status !== "approved") {
        // Seller not approved — redirect to pending page or register
        router.replace("/seller/register");
        return;
      }

      // Authorized seller
      setSellerName(seller.business_name || "Shopora Seller");
      const initials = (seller.business_name || profile.full_name || "S")
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();
      setSellerInitials(initials || "S");
      setAuthState("authorized");
    };

    void checkSellerAuth();

    return () => {
      active = false;
    };
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
    <SellerLayout storeName={sellerName} userInitials={sellerInitials}>
      {children}
    </SellerLayout>
  );
}
