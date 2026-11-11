"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Redirect old /seller/dashboard to new /seller home
export default function DashboardContent() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/seller");
  }, [router]);
  return null;
}
