"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/src/lib/supabase/client";
import AdminSidebar from "./AdminSidebar";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AdminLayoutProps {
  children: React.ReactNode;
  adminName?: string;
  adminInitials?: string;
}

/* ------------------------------------------------------------------ */
/*  Breadcrumb helper                                                  */
/* ------------------------------------------------------------------ */

const sectionLabels: Record<string, string> = {
  admin: "Admin",
  dashboard: "Dashboard",
  orders: "Orders",
  products: "Products",
  categories: "Categories",
  brands: "Brands",
  sellers: "Sellers",
  applications: "Applications",
  customers: "Customers",
  finances: "Finances",
  payouts: "Payouts",
  commissions: "Commissions",
  analytics: "Analytics",
  content: "Content",
  discounts: "Discounts",
  settings: "Settings",
};

function buildBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];

  let accumulated = "";
  for (const seg of segments) {
    accumulated += `/${seg}`;
    const label =
      sectionLabels[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
    crumbs.push({ label, href: accumulated });
  }

  return crumbs;
}

/* ------------------------------------------------------------------ */
/*  Inline icons                                                       */
/* ------------------------------------------------------------------ */

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const BellIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "shopora-admin-sidebar-collapsed";

export default function AdminLayout({
  children,
  adminName = "Admin",
  adminInitials = "A",
}: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* Sync collapsed state (read-only, sidebar owns the truth) */
  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      /* ignore */
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setSidebarCollapsed(e.newValue === "true");
      }
    };
    window.addEventListener("storage", handleStorage);

    /* Poll local storage to keep in sync within same tab */
    const interval = setInterval(() => {
      try {
        setSidebarCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
      } catch {
        /* ignore */
      }
    }, 300);

    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  }, []);

  /* Close mobile menu on route change */
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  /* Close dropdown on outside click */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSignOut = useCallback(async () => {
    try { sessionStorage.removeItem("shopora_role_cache"); } catch { /* ignore */ }
    await supabase.auth.signOut();
    router.push("/admin/login");
  }, [router]);

  const breadcrumbs = buildBreadcrumbs(pathname ?? "/admin");

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* ---- Desktop sidebar ---- */}
      <div className="hidden lg:block">
        <AdminSidebar adminName={adminName} adminInitials={adminInitials} />
      </div>

      {/* ---- Mobile overlay sidebar ---- */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Sidebar */}
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <AdminSidebar adminName={adminName} adminInitials={adminInitials} />
          </div>
        </>
      )}

      {/* ---- Main area ---- */}
      <div
        className={`flex flex-1 flex-col transition-[margin] duration-200 ease-in-out ${
          sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
        }`}
      >
        {/* ---- Top bar ---- */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
          {/* Left: hamburger + breadcrumbs */}
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              className="lg:hidden flex items-center justify-center rounded-md p-1 text-gray-500 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen((p) => !p)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>

            {/* Breadcrumbs */}
            <nav aria-label="Breadcrumb" className="hidden sm:block">
              <ol className="flex items-center gap-1 text-sm">
                {breadcrumbs.map((crumb, i) => (
                  <li key={crumb.href} className="flex items-center gap-1">
                    {i > 0 && (
                      <span className="text-gray-300 select-none">/</span>
                    )}
                    {i === breadcrumbs.length - 1 ? (
                      <span className="font-medium text-gray-900">
                        {crumb.label}
                      </span>
                    ) : (
                      <Link
                        href={crumb.href}
                        className="text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        {crumb.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          </div>

          {/* Right: search + bell + avatar */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative hidden md:block">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2">
                <SearchIcon />
              </span>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-56 rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-violet-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-200 transition-colors"
              />
            </div>

            {/* Notification bell */}
            <button
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              aria-label="Notifications"
            >
              <BellIcon />
              {/* Unread dot */}
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
            </button>

            {/* User avatar + dropdown */}
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setUserDropdownOpen((p) => !p)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white hover:bg-violet-700 transition-colors"
                aria-label="User menu"
              >
                {adminInitials}
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 top-11 z-50 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg animate-in fade-in slide-in-from-top-1">
                  <div className="border-b border-gray-100 px-4 py-2">
                    <p className="text-sm font-medium text-gray-900">
                      {adminName}
                    </p>
                    <p className="text-xs text-gray-500">Platform Admin</p>
                  </div>
                  <Link
                    href="/admin/settings"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={() => setUserDropdownOpen(false)}
                  >
                    Admin Settings
                  </Link>
                  <Link
                    href="/"
                    target="_blank"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={() => setUserDropdownOpen(false)}
                  >
                    View Storefront
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ---- Content ---- */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
