"use client";

import Link from "next/link";

export default function PendingContent() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      {/* Top Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400 font-black text-slate-950">
              S
            </span>
            <span className="text-xl font-extrabold tracking-tight text-white">
              Shopora <span className="text-xs font-semibold uppercase text-amber-400">Seller Central</span>
            </span>
          </Link>
          <Link
            href="/seller"
            className="rounded-lg border border-slate-700 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
          >
            Go to Dashboard
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-md space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400/10 text-3xl text-amber-400 border border-amber-400/20">
            ⏳
          </div>

          <div>
            <span className="rounded-full bg-amber-400/20 border border-amber-400/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300">
              Application Under Review
            </span>
            <h1 className="mt-4 text-2xl font-black text-white">
              Verification in Progress
            </h1>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed max-w-md mx-auto">
            Thank you for applying to sell on Shopora. Our compliance team is verifying your business details, address, and credentials. You will receive access to your seller dashboard as soon as approval is granted.
          </p>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-left text-xs space-y-2 text-slate-400">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              What happens next?
            </div>
            <p>1. Marketplace admin reviews your GST &amp; store details.</p>
            <p>2. Once verified, your status updates to <strong className="text-indigo-400">Approved</strong> automatically.</p>
            <p>3. You can immediately list products and fulfill customer orders.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              href="/"
              className="flex-1 rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition text-center"
            >
              Browse Customer Store
            </Link>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 rounded-xl bg-amber-400 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-500 transition"
            >
              Check Status
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
