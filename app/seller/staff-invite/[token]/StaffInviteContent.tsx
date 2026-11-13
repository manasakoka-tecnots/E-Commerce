"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * This page has been moved to /invite/[token] (outside the /seller auth wrapper).
 * This component only exists to redirect old links.
 */
export default function StaffInviteContent() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  useEffect(() => {
    // Redirect to the new invite page outside /seller
    router.replace(`/invite/${token}`);
  }, [router, token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#ff3f6c]" />
    </div>
  );
}
