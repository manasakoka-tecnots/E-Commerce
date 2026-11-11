"use client";

import Link from "next/link";
import { useState } from "react";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail("");
    }
  };

  return (
    <footer className="bg-[#fafafa] text-slate-600 border-t border-slate-200">
      {/* Main footer */}
      <div className="mx-auto max-w-[1100px] px-4 pt-10 pb-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
          {/* Online Shopping */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Online Shopping</h4>
            <ul className="mt-3 space-y-2 text-xs">
              {[
                { label: "All Products", href: "/products" },
                { label: "New Arrivals", href: "/products" },
                { label: "Become a Seller", href: "/seller/register" },
              ].map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-slate-500 transition hover:text-[#ff3f6c]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Policies */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Customer Policies</h4>
            <ul className="mt-3 space-y-2 text-xs">
              {[
                "Contact Us",
                "FAQ",
                "Terms of Use",
                "Privacy Policy",
                "Returns & Refunds",
                "Shipping",
              ].map((label) => (
                <li key={label}>
                  <span className="text-slate-500 transition hover:text-[#ff3f6c] cursor-pointer">
                    {label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Useful Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Useful Links</h4>
            <ul className="mt-3 space-y-2 text-xs">
              {[
                { label: "My Orders", href: "/dashboard" },
                { label: "My Wishlist", href: "/wishlist" },
                { label: "My Cart", href: "/cart" },
                { label: "My Account", href: "/dashboard" },
              ].map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-slate-500 transition hover:text-[#ff3f6c]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Experience Shopora App */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Experience Shopora App</h4>
            <div className="mt-3 flex flex-col gap-2">
              <span className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3 py-2 text-xs text-slate-600 transition hover:border-[#ff3f6c] cursor-pointer">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                App Store
              </span>
              <span className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3 py-2 text-xs text-slate-600 transition hover:border-[#ff3f6c] cursor-pointer">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-1.4l2.585 1.493a1 1 0 010 1.732l-2.585 1.493-2.545-2.545 2.545-2.174zM5.864 2.658L16.8 9.99l-2.302 2.302-8.635-8.635z" />
                </svg>
                Google Play
              </span>
            </div>
          </div>

          {/* Keep in Touch */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Keep in Touch</h4>
            <div className="mt-3 flex items-center gap-3">
              <a href="#" aria-label="Facebook" className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-slate-600 transition hover:bg-[#ff3f6c] hover:text-white">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                </svg>
              </a>
              <a href="#" aria-label="Twitter" className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-slate-600 transition hover:bg-[#ff3f6c] hover:text-white">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="#" aria-label="Instagram" className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-slate-600 transition hover:bg-[#ff3f6c] hover:text-white">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.17.054 1.97.24 2.43.403a4.92 4.92 0 011.675 1.092 4.92 4.92 0 011.092 1.675c.163.46.35 1.26.404 2.43.058 1.266.069 1.646.069 4.85s-.012 3.584-.07 4.85c-.054 1.17-.24 1.97-.404 2.43a4.92 4.92 0 01-1.092 1.675 4.92 4.92 0 01-1.675 1.092c-.46.163-1.26.35-2.43.404-1.266.058-1.646.069-4.85.069s-3.584-.012-4.85-.07c-1.17-.054-1.97-.24-2.43-.404a4.92 4.92 0 01-1.675-1.092A4.92 4.92 0 011.953 19.5c-.163-.46-.35-1.26-.404-2.43C1.491 15.804 1.48 15.424 1.48 12.22s.012-3.584.07-4.85c.054-1.17.24-1.97.404-2.43A4.92 4.92 0 013.045 3.265 4.92 4.92 0 014.72 2.173c.46-.163 1.26-.35 2.43-.404C8.416 1.711 8.796 1.7 12 1.7zm0 1.838c-3.153 0-3.506.013-4.748.069-1.075.049-1.658.228-2.047.379a3.088 3.088 0 00-1.15.748 3.088 3.088 0 00-.748 1.15c-.151.389-.33.972-.379 2.047C2.85 8.494 2.838 8.847 2.838 12s.013 3.506.069 4.748c.049 1.075.228 1.658.379 2.047.176.468.44.895.748 1.15.255.308.682.572 1.15.748.389.151.972.33 2.047.379 1.242.056 1.595.069 4.748.069s3.506-.013 4.748-.069c1.075-.049 1.658-.228 2.047-.379a3.3 3.3 0 001.898-1.898c.151-.389.33-.972.379-2.047.056-1.242.069-1.595.069-4.748s-.013-3.506-.069-4.748c-.049-1.075-.228-1.658-.379-2.047a3.088 3.088 0 00-.748-1.15 3.088 3.088 0 00-1.15-.748c-.389-.151-.972-.33-2.047-.379C15.506 4.013 15.153 4 12 4zm0 3.838a4.162 4.162 0 110 8.324 4.162 4.162 0 010-8.324zm0 1.838a2.325 2.325 0 100 4.65 2.325 2.325 0 000-4.65zm4.406-2.968a.975.975 0 110 1.95.975.975 0 010-1.95z" />
                </svg>
              </a>
              <a href="#" aria-label="YouTube" className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-slate-600 transition hover:bg-[#ff3f6c] hover:text-white">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>

            {/* Newsletter */}
            <div className="mt-4">
              {subscribed ? (
                <p className="text-xs font-bold text-teal-600">Thanks for subscribing!</p>
              ) : (
                <form onSubmit={handleSubscribe} className="flex gap-0">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Your email"
                    className="w-full border border-slate-300 border-r-0 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-[#ff3f6c] transition"
                  />
                  <button
                    type="submit"
                    className="shrink-0 bg-[#ff3f6c] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-[#e5355f]"
                  >
                    Subscribe
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Guarantees strip */}
        <div className="mt-8 border-t border-slate-200 pt-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-4">
            100% Original guarantee for all products at shopora.com
          </h4>
          <div className="flex flex-wrap gap-6 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              100% Authentic
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21M3.375 14.25h4.875c.621 0 1.125-.504 1.125-1.125v-3.375c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v3.375c0 .621.504 1.125 1.125 1.125zm0 0V7.5A2.25 2.25 0 015.625 5.25h12.75A2.25 2.25 0 0120.625 7.5v6.75" />
              </svg>
              Free Delivery
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              Easy Returns
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
              Secure Payment
            </div>
          </div>
        </div>

        {/* Payment methods */}
        <div className="mt-6 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span>We accept:</span>
          {["Visa", "Mastercard", "UPI", "RuPay", "Net Banking", "COD"].map((m) => (
            <span key={m} className="border border-slate-200 bg-white px-2 py-0.5 text-slate-500">
              {m}
            </span>
          ))}
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-[1100px] px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <Link href="/" className="text-base font-extrabold text-[#ff3f6c] tracking-tight">
            Shopora
          </Link>
          <p className="text-[10px] text-slate-400">
            &copy; {new Date().getFullYear()} www.shopora.com. All rights reserved.
          </p>
          <p className="text-[10px] text-slate-400">
            A Beautifully Crafted Marketplace
          </p>
        </div>
      </div>
    </footer>
  );
}
