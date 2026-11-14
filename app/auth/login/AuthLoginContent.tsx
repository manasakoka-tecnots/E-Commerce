"use client";

import Link from "next/link";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/src/lib/supabase/client";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

type LoginForm = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "";
  const roleHint = searchParams.get("role") ?? "";
  const verified = searchParams.get("verified") === "true";
  const errorParam = searchParams.get("error") ?? "";
  const [errorMsg, setErrorMsg] = useState(errorParam);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setErrorMsg("");

    // Use the session directly from signInWithPassword — don't rely on getSession()
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

    // Always detect role first — this caches it for SellerAuthWrapper and StaffContext
    // so they don't need another API call on first load.
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
        console.warn(`[Login] detect-role attempt ${attempt + 1} failed: ${res.status}`);
      } catch (err) {
        console.warn(`[Login] detect-role attempt ${attempt + 1} error:`, err);
      }
      if (attempt < 1) await new Promise(r => setTimeout(r, 1000));
    }

    if (roleData) {
      // Cache role data for SellerAuthWrapper and StaffContext
      try {
        sessionStorage.setItem("shopora_role_cache", JSON.stringify({
          ...roleData,
          cachedAt: Date.now(),
        }));
      } catch { /* sessionStorage unavailable in some contexts */ }

      // If there's a redirect (e.g., from invite page or seller/staff login),
      // go there — but only if the user's role actually matches
      if (redirectTo) {
        const isSeller = roleData.role === "seller" || roleData.role === "staff" || roleData.role === "admin";
        const isSellerRoute = redirectTo.startsWith("/seller");
        if (isSellerRoute && !isSeller) {
          setErrorMsg("You don't have access to the seller portal. Please contact the seller who invited you.");
          setLoading(false);
          return;
        }
        router.replace(redirectTo);
        setLoading(false);
        return;
      }

      if (roleData.role === "admin") {
        router.replace("/admin/dashboard");
        return;
      }
      if (roleData.role === "seller" || roleData.role === "staff") {
        router.replace("/seller/dashboard");
        return;
      }
      if (roleData.role === "seller_pending") {
        setErrorMsg("Your seller account is not active yet. Please complete registration details or contact support.");
        setLoading(false);
        return;
      }
    } else {
      console.error("[Login] detect-role failed after retries");
      setErrorMsg("Unable to detect your account type. Please try logging in again.");
      setLoading(false);
      return;
    }

    // Default: customer dashboard
    router.replace("/dashboard");
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen bg-[#fce4ec]">
      {/* Left branding panel — Myntra style with illustration area */}
      <div className="hidden lg:flex lg:w-[45%] items-center justify-center bg-[#ff3f6c] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-300 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 px-12 text-center">
          <Link href="/" className="text-4xl font-extrabold text-white tracking-tight">
            Shopora
          </Link>
          <h1 className="mt-8 text-3xl font-bold text-white leading-tight">
            The destination for<br />fashion & lifestyle
          </h1>
          <p className="mt-4 text-pink-100 text-base max-w-sm mx-auto">
            Discover thousands of products from verified sellers across India. Shop with confidence.
          </p>
          <div className="mt-10 flex items-center justify-center gap-8">
            <div className="text-center">
              <p className="text-3xl font-bold text-white">10K+</p>
              <p className="text-xs text-pink-200">Products</p>
            </div>
            <div className="w-px h-10 bg-pink-400" />
            <div className="text-center">
              <p className="text-3xl font-bold text-white">500+</p>
              <p className="text-xs text-pink-200">Sellers</p>
            </div>
            <div className="w-px h-10 bg-pink-400" />
            <div className="text-center">
              <p className="text-3xl font-bold text-white">50K+</p>
              <p className="text-xs text-pink-200">Happy Customers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex w-full lg:w-[55%] items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-[400px] space-y-6">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-4">
            <Link href="/" className="text-3xl font-extrabold text-[#ff3f6c] tracking-tight">
              Shopora
            </Link>
          </div>

          {roleHint === "staff" && (
            <div className="rounded-lg bg-teal-50 border border-teal-200 px-4 py-3">
              <p className="text-sm font-medium text-teal-800">Staff Login</p>
              <p className="text-xs text-teal-600 mt-0.5">Sign in with the email and password from your staff invite.</p>
            </div>
          )}

          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {roleHint === "staff" ? "Staff Sign In" : (<>Login <span className="text-sm font-normal text-slate-500">or</span> Signup</>)}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {roleHint === "staff"
                ? "Enter your credentials to access the seller dashboard"
                : "Get access to your Orders, Wishlist and Recommendations"}
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
                className={`block w-full border-b-2 bg-transparent px-0 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition ${errors.email ? "border-red-400" : "border-slate-200 focus:border-[#ff3f6c]"}`}
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
                  className={`block w-full border-b-2 bg-transparent px-0 py-3 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition ${errors.password ? "border-red-400" : "border-slate-200 focus:border-[#ff3f6c]"}`}
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

            {verified && (
              <div className="rounded bg-teal-50 border border-teal-200 px-4 py-3">
                <p className="text-sm text-teal-700 font-medium">Email verified! You can now sign in.</p>
              </div>
            )}

            {errorMsg && (
              <div className="rounded bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-600">{errorMsg}</p>
              </div>
            )}

            <p className="text-xs text-slate-400">
              By continuing, I agree to the{" "}
              <span className="font-bold text-[#ff3f6c]">Terms of Use</span> &amp;{" "}
              <span className="font-bold text-[#ff3f6c]">Privacy Policy</span>
            </p>

            <button
              type="submit"
              disabled={loading}
              suppressHydrationWarning
              className="w-full bg-[#ff3f6c] py-3.5 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#e5355f] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Signing in...
                </span>
              ) : "Login"}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-4 text-slate-400">New to Shopora?</span>
            </div>
          </div>

          <Link
            href={redirectTo ? `/auth/register?redirect=${encodeURIComponent(redirectTo)}` : "/auth/register"}
            className="block w-full border-2 border-slate-300 py-3 text-center text-sm font-bold uppercase tracking-wider text-[#ff3f6c] transition hover:border-[#ff3f6c]"
          >
            Create an Account
          </Link>

          <p className="text-center text-xs text-slate-400">
            {redirectTo?.startsWith("/seller") ? (
              <Link href="/seller" className="hover:text-teal-600 transition">
                &larr; Back to Seller Central
              </Link>
            ) : (
              <Link href="/" className="hover:text-[#ff3f6c] transition">
                &larr; Back to home
              </Link>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthLoginContent() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
