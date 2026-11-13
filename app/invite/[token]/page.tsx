import { Suspense } from "react";
import InviteContent from "./InviteContent";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#ff3f6c]" />
        </div>
      }
    >
      <InviteContent />
    </Suspense>
  );
}
