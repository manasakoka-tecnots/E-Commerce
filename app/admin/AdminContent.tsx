"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminContent() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/dashboard");
  }, [router]);

  return (
    <div className="flex items-center justify-center p-16">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
    </div>
  );
}
