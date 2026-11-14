"use client";

import Link from "next/link";

// Simple inline SVG icon components (no external dependency)
function IconArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

const FEATURES = [
  {
    emoji: "\uD83D\uDCE6",
    title: "Product Management",
    desc: "List products, manage inventory, set pricing and variants with ease.",
  },
  {
    emoji: "\uD83D\uDCCA",
    title: "Sales Analytics",
    desc: "Track revenue, orders, and growth with real-time dashboards.",
  },
  {
    emoji: "\uD83D\uDE9A",
    title: "Order Tracking",
    desc: "Manage orders from placement to delivery in one view.",
  },
  {
    emoji: "\uD83D\uDC65",
    title: "Staff Management",
    desc: "Invite team members, assign roles, and control permissions by location.",
  },
  {
    emoji: "\uD83C\uDFEA",
    title: "Multi-Location",
    desc: "Manage multiple store locations with independent inventory.",
  },
  {
    emoji: "\uD83D\uDD12",
    title: "Role-Based Access",
    desc: "Admin, Manager, and Associate roles with granular permissions.",
  },
];

const BENEFITS = [
  "Reach millions of customers",
  "Easy product listing tools",
  "Secure payment processing",
  "24/7 seller support",
  "Real-time analytics",
  "Multi-location inventory",
  "Staff & role management",
  "Marketing & promotions",
];

const STEPS = [
  { step: "1", title: "Get Invited", desc: "Your seller sends you an invite email with a signup link." },
  { step: "2", title: "Create Account", desc: "Click the link, set your password, and join the team." },
  { step: "3", title: "Start Working", desc: "Log in here anytime to access your seller dashboard." },
];

export default function SellerLandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-800 text-white font-bold text-sm">
              S
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                Shopora Seller Central
              </h1>
              <p className="text-xs text-gray-500">Manage your business</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/seller/login"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Seller Login
            </Link>
            <Link
              href="/seller/login?role=staff"
              className="rounded-lg border border-teal-600 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 transition-colors"
            >
              Staff Login
            </Link>
            <Link
              href="/seller/register"
              className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900 transition-colors"
            >
              Register as Seller
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-teal-800 via-teal-900 to-gray-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Sell on Shopora
            </h2>
            <p className="mt-4 text-lg text-teal-100">
              Join thousands of sellers and grow your business with our
              marketplace. Manage products, track orders, and scale your team —
              all from one powerful dashboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/seller/register"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-teal-900 shadow-lg hover:bg-gray-100 transition-colors"
              >
                Start Selling
                <IconArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/seller/login"
                className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
              >
                Seller Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h3 className="text-center text-2xl font-bold text-gray-900">
            Everything you need to run your business
          </h3>
          <p className="mt-2 text-center text-gray-600">
            Powerful tools to manage your store, orders, and team
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-xl">
                  {feature.emoji}
                </div>
                <h4 className="mt-4 font-semibold text-gray-900">
                  {feature.title}
                </h4>
                <p className="mt-2 text-sm text-gray-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Staff Section */}
      <section className="border-t border-gray-200 bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 mb-4">
              <svg className="h-7 w-7 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">
              Staff Member? Sign In Here
            </h3>
            <p className="mt-2 text-gray-600 max-w-lg mx-auto">
              If your seller has invited you as a team member (Admin, Manager, or Associate),
              sign in with the email and password you set up during the invite process.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/seller/login?role=staff"
                className="inline-flex items-center gap-2 rounded-lg bg-teal-800 px-8 py-3 text-sm font-semibold text-white hover:bg-teal-900 transition-colors shadow-sm"
              >
                Staff Login
                <IconArrowRight className="h-4 w-4" />
              </Link>
              <span className="text-xs text-gray-400">Use the same email from your invite</span>
            </div>
          </div>

          <div className="mt-12">
            <p className="text-center text-sm font-medium text-gray-500 mb-6">How staff onboarding works</p>
            <div className="grid gap-6 sm:grid-cols-3">
              {STEPS.map((item) => (
                <div
                  key={item.step}
                  className="flex gap-4 rounded-lg bg-white p-5 shadow-sm"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-800 text-sm font-bold text-white">
                    {item.step}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{item.title}</h4>
                    <p className="mt-1 text-sm text-gray-600">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why Sell Section */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h3 className="text-center text-2xl font-bold text-gray-900">
            Why sell on Shopora?
          </h3>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((benefit) => (
              <div key={benefit} className="flex items-center gap-2">
                <IconCheck className="h-5 w-5 shrink-0 text-teal-700" />
                <span className="text-sm text-gray-700">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-gray-200 bg-teal-800 py-12">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h3 className="text-2xl font-bold text-white">
            Ready to grow your business?
          </h3>
          <p className="mt-2 text-teal-100">
            Register today and start selling to millions of customers.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link
              href="/seller/register"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-teal-900 hover:bg-gray-100 transition-colors"
            >
              Register as Seller
            </Link>
            <Link
              href="/seller/login"
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-6">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Shopora. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
