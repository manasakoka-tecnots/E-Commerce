import { Suspense } from "react";
import AuthRegisterContent from "./AuthRegisterContent";

export default function Page() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-teal-800" /></div>}>
      <AuthRegisterContent />
    </Suspense>
  );
}
