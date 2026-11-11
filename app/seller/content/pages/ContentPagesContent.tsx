"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ContentPagesContent() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/seller/store/pages");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-500">Redirecting to Store Pages...</p>
    </div>
  );
}
