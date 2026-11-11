"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase/client";

export default function AdminLoginContent() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authErr) {
      setErrorMsg(authErr.message);
      setLoading(false);
      return;
    }

    const user = authData.user;
    if (!user) {
      setErrorMsg("Authentication failed. Please check your credentials.");
      setLoading(false);
      return;
    }

    if (!user.email_confirmed_at) {
      await supabase.auth.signOut();
      setErrorMsg("Please verify your email before signing in.");
      setLoading(false);
      return;
    }

    // Role check: Must be 'admin' in profiles table
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("auth_uid", user.id)
      .maybeSingle();

    setLoading(false);

    if (profErr) {
      setErrorMsg(`Could not load your account role: ${profErr.message}`);
      return;
    }

    if (profile?.role === "admin") {
      router.replace("/admin/dashboard");
    } else {
      setErrorMsg("This login is for administrators only. Please use the regular sign-in page.");
      await supabase.auth.signOut();
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      {/* Top Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 font-black text-white shadow-md">
              S
            </span>
            <div>
              <span className="text-xl font-black tracking-tight text-white">
                Shopora
              </span>
              <span className="ml-2 rounded-md bg-indigo-500/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-300 border border-indigo-500/30">
                Operations Console
              </span>
            </div>
          </Link>

          <Link
            href="/"
            className="text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            ← Back to Storefront
          </Link>
        </div>
      </header>

      {/* Main Admin Login Card */}
      <main className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 py-12">
        <div className="w-full rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-md space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/20 text-2xl text-indigo-400 border border-indigo-500/30">
              Admin
            </div>
            <h1 className="text-2xl font-black text-white">Admin Authentication</h1>
            <p className="text-xs text-slate-400">
              Sign in with authorized marketplace administrator credentials.
            </p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Admin Email
              </label>
              <input
                type="email"
                required
                placeholder="admin@shopora.internal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {errorMsg && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-extrabold text-white shadow-md hover:bg-indigo-500 disabled:opacity-50 transition active:scale-[0.99]"
            >
              {loading ? "Authenticating…" : "Sign In to Admin Console"}
            </button>
          </form>

          <div className="border-t border-slate-800 pt-4 text-center">
            <p className="text-[11px] text-slate-500">
              Public registration is disabled for administrator roles. Admin privileges must be provisioned directly by the database owner.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        <p>© 2026 Shopora Technologies Pvt. Ltd. Restricted Operations Portal.</p>
      </footer>
    </div>
  );
}
