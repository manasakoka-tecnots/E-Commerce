"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProductsCollectionsContent() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/seller/collections");
  }, [router]);

  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
    </div>
  );
}
