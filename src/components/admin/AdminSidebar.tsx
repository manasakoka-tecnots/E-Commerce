"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SubItem {
  label: string;
  href: string;
}

interface MenuItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  subItems?: SubItem[];
}

interface AdminSidebarProps {
  adminName?: string;
  adminInitials?: string;
}

/* ------------------------------------------------------------------ */
/*  SVG Icons (inline, 20x20)                                         */
/* ------------------------------------------------------------------ */

const icons = {
  home: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  orders: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </svg>
  ),
  products: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  sellers: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  customers: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  finances: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  analytics: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  content: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  discounts: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="2" />
      <circle cx="15" cy="15" r="2" />
      <line x1="7" y1="17" x2="17" y2="7" />
      <rect x="2" y="2" width="20" height="20" rx="2" />
    </svg>
  ),
  settings: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08z" />
    </svg>
  ),
  chevronDown: (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  chevronRight: (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  collapse: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  externalLink: (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  ),
};

/* ------------------------------------------------------------------ */
/*  Menu definition                                                    */
/* ------------------------------------------------------------------ */

const menuItems: MenuItem[] = [
  {
    label: "Home",
    href: "/admin",
    icon: icons.home,
  },
  {
    label: "Orders",
    href: "/admin/orders",
    icon: icons.orders,
  },
  {
    label: "Products",
    href: "/admin/products",
    icon: icons.products,
    subItems: [
      { label: "All Products", href: "/admin/products" },
      { label: "Categories", href: "/admin/products/categories" },
      { label: "Brands", href: "/admin/products/brands" },
    ],
  },
  {
    label: "Sellers",
    href: "/admin/sellers",
    icon: icons.sellers,
    subItems: [
      { label: "All Sellers", href: "/admin/sellers" },
      { label: "Applications", href: "/admin/sellers/applications" },
    ],
  },
  {
    label: "Customers",
    href: "/admin/customers",
    icon: icons.customers,
  },
  {
    label: "Finances",
    href: "/admin/finances",
    icon: icons.finances,
    subItems: [
      { label: "Overview", href: "/admin/finances" },
      { label: "Payouts", href: "/admin/finances/payouts" },
      { label: "Commissions", href: "/admin/finances/commissions" },
    ],
  },
  {
    label: "Analytics",
    href: "/admin/analytics",
    icon: icons.analytics,
  },
  {
    label: "Content",
    href: "/admin/content",
    icon: icons.content,
  },
  {
    label: "Discounts",
    href: "/admin/discounts",
    icon: icons.discounts,
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: icons.settings,
  },
];

/* ------------------------------------------------------------------ */
/*  Sidebar component                                                  */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "shopora-admin-sidebar-collapsed";

export default function AdminSidebar({
  adminName = "Admin",
  adminInitials = "A",
}: AdminSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );
  const [mounted, setMounted] = useState(false);

  /* Hydrate collapsed state from localStorage */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "true") setCollapsed(true);
    } catch {
      /* SSR or storage unavailable */
    }
    setMounted(true);
  }, []);

  /* Auto-expand section containing the active route */
  useEffect(() => {
    if (!pathname) return;
    const active = menuItems.find(
      (item) =>
        item.subItems &&
        (pathname === item.href ||
          item.subItems.some((sub) => pathname === sub.href))
    );
    if (active) {
      setExpandedSections((prev) => new Set(prev).add(active.label));
    }
  }, [pathname]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toggleSection = useCallback((label: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  const isActive = (href: string) => pathname === href;

  const isSectionActive = (item: MenuItem) =>
    pathname === item.href ||
    (item.subItems?.some((sub) => pathname === sub.href) ?? false);

  /* Prevent flash of wrong width before hydration */
  if (!mounted) return null;

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col bg-slate-900 text-slate-300 transition-[width] duration-200 ease-in-out ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* ---- Logo / Toggle ---- */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 px-3">
        {!collapsed && (
          <Link
            href="/admin"
            className="flex items-center gap-2 text-white font-semibold text-base tracking-tight"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-xs font-bold text-white">
              S
            </span>
            Shopora
            <span className="rounded bg-violet-500/20 border border-violet-500/30 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-300">
              Admin
            </span>
          </Link>
        )}
        <button
          onClick={toggleCollapsed}
          className={`flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white transition-colors ${
            collapsed ? "mx-auto" : ""
          }`}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {icons.collapse}
        </button>
      </div>

      {/* ---- Scrollable nav ---- */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-thin scrollbar-thumb-slate-700">
        <ul className="flex flex-col gap-0.5 px-2">
          {menuItems.map((item) => {
            const sectionActive = isSectionActive(item);
            const expanded = expandedSections.has(item.label);
            const hasChildren = !!item.subItems?.length;

            return (
              <li key={item.label}>
                {/* Parent row */}
                {hasChildren ? (
                  <button
                    onClick={() => {
                      if (collapsed) {
                        /* Expand sidebar first if collapsed, then expand section */
                        setCollapsed(false);
                        try {
                          localStorage.setItem(STORAGE_KEY, "false");
                        } catch {
                          /* ignore */
                        }
                        setExpandedSections((prev) =>
                          new Set(prev).add(item.label)
                        );
                      } else {
                        toggleSection(item.label);
                      }
                    }}
                    className={`group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                      sectionActive
                        ? "border-l-2 border-violet-500 bg-violet-600/10 text-violet-400"
                        : "border-l-2 border-transparent hover:bg-slate-800 hover:text-white"
                    } ${collapsed ? "justify-center px-0" : ""}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate text-left">
                          {item.label}
                        </span>
                        <span
                          className={`shrink-0 transition-transform duration-150 ${
                            expanded ? "rotate-0" : "-rotate-90"
                          }`}
                        >
                          {icons.chevronDown}
                        </span>
                      </>
                    )}
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    className={`group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                      isActive(item.href)
                        ? "border-l-2 border-violet-500 bg-violet-600/10 text-violet-400"
                        : "border-l-2 border-transparent hover:bg-slate-800 hover:text-white"
                    } ${collapsed ? "justify-center px-0" : ""}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </Link>
                )}

                {/* Sub-items */}
                {hasChildren && !collapsed && expanded && (
                  <ul className="mt-0.5 mb-1 ml-5 flex flex-col gap-0.5 border-l border-slate-700 pl-3">
                    {item.subItems!.map((sub) => (
                      <li key={sub.href}>
                        <Link
                          href={sub.href}
                          className={`block rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            isActive(sub.href)
                              ? "text-violet-400"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          {sub.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ---- Bottom section ---- */}
      <div className="shrink-0 border-t border-slate-800 p-2">
        {/* View storefront link */}
        {!collapsed ? (
          <Link
            href="/"
            target="_blank"
            className="mb-2 flex items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            {icons.externalLink}
            <span>View Storefront</span>
          </Link>
        ) : (
          <Link
            href="/"
            target="_blank"
            className="mb-2 flex items-center justify-center rounded-md py-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            title="View Storefront"
          >
            {icons.externalLink}
          </Link>
        )}

        {/* User / Admin */}
        <div
          className={`flex items-center gap-2.5 rounded-md px-2 py-2 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
            {adminInitials}
          </span>
          {!collapsed && (
            <span className="truncate text-xs font-medium text-slate-300">
              {adminName}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
