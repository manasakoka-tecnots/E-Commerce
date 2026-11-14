"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/src/lib/supabase/client";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Suspense } from "react";

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

type LoginFormData = z.infer<typeof loginSchema>;

function SellerLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isStaff = searchParams.get("role") === "staff";
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setErrorMsg("");

    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) {
      if (error.message === "Email not confirmed") {
        setErrorMsg("Your email is not verified yet. Please check your inbox and click the verification link.");
      } else {
        setErrorMsg(error.message);
      }
      setLoading(false);
      return;
    }

    const accessToken = signInData.session?.access_token;
    if (!accessToken) {
      setErrorMsg("Login succeeded but no session was returned. Please try again.");
      setLoading(false);
      return;
    }

    // Detect role and cache it
    let roleData: Record<string, unknown> | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch("/api/auth/detect-role", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (res.ok) {
          roleData = await res.json();
          break;
        }
      } catch {
        // retry
      }
      if (attempt < 1) await new Promise(r => setTimeout(r, 1000));
    }

    if (roleData) {
      try {
        sessionStorage.setItem("shopora_role_cache", JSON.stringify({
          ...roleData,
          cachedAt: Date.now(),
        }));
      } catch { /* ignore */ }

      const role = roleData.role as string;
      if (role === "seller" || role === "staff" || role === "admin") {
        router.replace("/seller/dashboard");
        return;
      }
      if (role === "seller_pending") {
        setErrorMsg("Your seller account is not active yet. Please complete registration or contact support.");
        setLoading(false);
        return;
      }

      // Not a seller/staff — show error
      setErrorMsg("This account doesn't have seller or staff access. If you're a customer, please use the customer login.");
      setLoading(false);
      return;
    }

    setErrorMsg("Unable to verify your account. Please try again.");
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Left branding panel — Seller Central style */}
      <div className="hidden lg:flex lg:w-[45%] items-center justify-center bg-gradient-to-br from-teal-800 via-teal-900 to-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-teal-400 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-teal-300 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 px-12 text-center">
          <Link href="/seller" className="inline-flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-teal-900 font-bold text-lg">
              S
            </div>
            <span className="text-3xl font-extrabold text-white tracking-tight">
              Seller Central
            </span>
          </Link>
          <h1 className="mt-8 text-3xl font-bold text-white leading-tight">
            {isStaff ? "Welcome back,\nTeam Member" : "Manage your\nbusiness here"}
          </h1>
          <p className="mt-4 text-teal-200 text-base max-w-sm mx-auto">
            {isStaff
              ? "Sign in with your staff credentials to access the seller dashboard and manage your assigned tasks."
              : "Access your products, orders, analytics, and team management — all from one powerful dashboard."}
          </p>
          <div className="mt-10 flex items-center justify-center gap-8">
            <div className="text-center">
              <svg className="h-6 w-6 text-teal-300 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-xs text-teal-300">Products</p>
            </div>
            <div className="w-px h-10 bg-teal-700" />
            <div className="text-center">
              <svg className="h-6 w-6 text-teal-300 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
              <p className="text-xs text-teal-300">Orders</p>
            </div>
            <div className="w-px h-10 bg-teal-700" />
            <div className="text-center">
              <svg className="h-6 w-6 text-teal-300 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              <p className="text-xs text-teal-300">Team</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex w-full lg:w-[55%] items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-[400px] space-y-6">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-4">
            <Link href="/seller" className="inline-flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-800 text-white font-bold text-sm">
                S
              </div>
              <span className="text-2xl font-extrabold text-teal-900 tracking-tight">
                Seller Central
              </span>
            </Link>
          </div>

          {isStaff && (
            <div className="rounded-lg bg-teal-50 border border-teal-200 px-4 py-3">
              <p className="text-sm font-medium text-teal-800">Staff Login</p>
              <p className="text-xs text-teal-600 mt-0.5">Sign in with the email and password from your staff invite.</p>
            </div>
          )}

          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {isStaff ? "Staff Sign In" : "Seller Sign In"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {isStaff
                ? "Enter your credentials to access the seller dashboard"
                : "Access your store dashboard, products, and orders"}
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <input
                id="email"
                type="email"
                placeholder="Email Address"
                autoComplete="email"
                {...register("email")}
                suppressHydrationWarning
                className={`block w-full border-b-2 bg-transparent px-0 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition ${errors.email ? "border-red-400" : "border-slate-200 focus:border-teal-700"}`}
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>

            <div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  autoComplete="current-password"
                  {...register("password")}
                  suppressHydrationWarning
                  className={`block w-full border-b-2 bg-transparent px-0 py-3 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition ${errors.password ? "border-red-400" : "border-slate-200 focus:border-teal-700"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  )}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>

            {errorMsg && (
              <div className="rounded bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-600">{errorMsg}</p>
              </div>
            )}

            <p className="text-xs text-slate-400">
              By continuing, I agree to the{" "}
              <span className="font-bold text-teal-700">Terms of Use</span> &amp;{" "}
              <span className="font-bold text-teal-700">Privacy Policy</span>
            </p>

            <button
              type="submit"
              disabled={loading}
              suppressHydrationWarning
              className="w-full bg-teal-800 py-3.5 text-sm font-bold uppercase tracking-wider text-white rounded-lg transition hover:bg-teal-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Signing in...
                </span>
              ) : "Sign In"}
            </button>
          </form>

          {!isStaff && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-4 text-slate-400">New to Shopora?</span>
                </div>
              </div>

              <Link
                href="/seller/register"
                className="block w-full border-2 border-teal-700 py-3 text-center text-sm font-bold uppercase tracking-wider text-teal-800 rounded-lg transition hover:bg-teal-50"
              >
                Register as Seller
              </Link>
            </>
          )}

          {isStaff && (
            <p className="text-center text-xs text-slate-400">
              Don&apos;t have a staff account?{" "}
              <span className="text-slate-500">Ask your seller to send you an invite.</span>
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-slate-400">
            <Link href="/seller" className="hover:text-teal-700 transition">
              &larr; Back to Seller Central
            </Link>
            <Link href="/auth/login" className="hover:text-[#ff3f6c] transition">
              Customer Login &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SellerLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-teal-800" /></div>}>
      <SellerLoginForm />
    </Suspense>
  );
}
