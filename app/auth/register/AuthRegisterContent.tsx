"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/src/lib/supabase/client";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const registerSchema = z.object({
  fullName: z.string().min(1, { message: "Full name is required" }),
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function AuthRegisterContent() {
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Support redirect param (e.g., from staff invite page)
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const redirectTo = searchParams?.get("redirect") ?? "";

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    setErrorMsg("");
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
        },
        emailRedirectTo: redirectTo
          ? `${siteUrl}/auth/callback?next=${encodeURIComponent(redirectTo)}`
          : `${siteUrl}/auth/callback`,
      },
    });
    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setRegistered(true);
  };

  if (registered) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-50">
            <svg className="h-8 w-8 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Check your email</h2>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              We&apos;ve sent a verification link to your email address. Please click the link to verify your account.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Didn&apos;t receive it? Check your spam folder.
            </p>
          </div>
          <Link
            href={redirectTo ? `/auth/login?redirect=${encodeURIComponent(redirectTo)}` : "/auth/login"}
            className="inline-block bg-[#ff3f6c] px-10 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#e5355f]"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#fce4ec]">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-[45%] items-center justify-center bg-[#ff3f6c] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-32 right-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-96 h-96 bg-pink-300 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 px-12 text-center">
          <Link href="/" className="text-4xl font-extrabold text-white tracking-tight">
            Shopora
          </Link>
          <h1 className="mt-8 text-3xl font-bold text-white leading-tight">
            Looks like you&apos;re<br />new here!
          </h1>
          <p className="mt-4 text-pink-100 text-base max-w-sm mx-auto">
            Sign up with your email to get started with your shopping journey.
          </p>
          <div className="mt-10 space-y-4 text-left max-w-xs mx-auto">
            {[
              "Free shipping on your first order",
              "Secure payments & buyer protection",
              "Track orders in real-time",
            ].map((text) => (
              <div key={text} className="flex items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="text-sm text-pink-100">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex w-full lg:w-[55%] items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-[400px] space-y-6">
          <div className="lg:hidden text-center mb-4">
            <Link href="/" className="text-3xl font-extrabold text-[#ff3f6c] tracking-tight">
              Shopora
            </Link>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">Create Account</h2>
            <p className="mt-1 text-sm text-slate-400">
              Already have an account?{" "}
              <Link href="/auth/login" className="font-bold text-[#ff3f6c] hover:underline">
                Login
              </Link>
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <input
                id="fullName"
                type="text"
                placeholder="Full Name"
                autoComplete="name"
                {...register("fullName")}
                suppressHydrationWarning
                className={`block w-full border-b-2 bg-transparent px-0 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition ${errors.fullName ? "border-red-400" : "border-slate-200 focus:border-[#ff3f6c]"}`}
              />
              {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName.message}</p>}
            </div>

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
                  placeholder="Password (min 6 characters)"
                  autoComplete="new-password"
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

            <div>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm Password"
                  autoComplete="new-password"
                  {...register("confirmPassword")}
                  suppressHydrationWarning
                  className={`block w-full border-b-2 bg-transparent px-0 py-3 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition ${errors.confirmPassword ? "border-red-400" : "border-slate-200 focus:border-[#ff3f6c]"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                >
                  {showConfirmPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  )}
                </button>
              </div>
              {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>}
            </div>

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
                  Creating account...
                </span>
              ) : "Create Account"}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-4 text-slate-400">Already have an account?</span>
            </div>
          </div>

          <Link
            href="/auth/login"
            className="block w-full border-2 border-slate-300 py-3 text-center text-sm font-bold uppercase tracking-wider text-[#ff3f6c] transition hover:border-[#ff3f6c]"
          >
            Login
          </Link>

          <p className="text-center text-xs text-slate-400">
            <Link href="/" className="hover:text-[#ff3f6c] transition">
              &larr; Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
