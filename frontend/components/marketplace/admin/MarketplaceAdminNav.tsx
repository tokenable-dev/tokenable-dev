"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/ds/cn";
import {
  ADMIN_NAV_SECTIONS,
  isAdminMarketsPreviewActive,
  isAdminNavItemActive,
  type AdminNavIconName,
  type AdminNavItem,
} from "./nav/adminNavConfig";

function navItemActive(pathname: string, item: AdminNavItem): boolean {
  if (item.href === "/marketplace/admin/markets") {
    return isAdminMarketsPreviewActive(pathname);
  }
  return isAdminNavItemActive(pathname, item);
}

function AdminNavIcon({ name }: { name: AdminNavIconName }) {
  return (
    <svg
      className="admin-nav__icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

const ICON_PATHS: Record<AdminNavIconName, ReactNode> = {
  "layout-grid": (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  layers: (
    <>
      <path d="m12.83 2.18 8 4a1 1 0 0 1 0 1.64l-8 4a2 2 0 0 1-1.66 0l-8-4a1 1 0 0 1 0-1.64l8-4a2 2 0 0 1 1.66 0z" />
      <path d="m2.18 9.17 8 4a2 2 0 0 0 1.66 0l8-4" />
      <path d="m2.18 14.17 8 4a2 2 0 0 0 1.66 0l8-4" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.5-3.5a2 2 0 0 0-3 0L5 21" />
    </>
  ),
  package: (
    <>
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </>
  ),
  "arrow-up-right": (
    <>
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </>
  ),
  banknote: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  handshake: (
    <>
      <path d="m11 17 2 2a1 1 0 1 0 3-3" />
      <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.3l2.53 1.94" />
      <path d="M2 15l6.5-6.5" />
      <path d="M7 20 2 15" />
    </>
  ),
  upload: (
    <>
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 21h14" />
    </>
  ),
  store: (
    <>
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M15 22v-4a3 3 0 0 0-6 0v4" />
      <path d="M2 7h20" />
    </>
  ),
  "refresh-cw": (
    <>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </>
  ),
  briefcase: (
    <>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </>
  ),
  key: (
    <>
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </>
  ),
  "arrow-left-right": (
    <>
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="m16 21 4-4-4-4" />
      <path d="M20 17H4" />
    </>
  ),
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  "list-checks": (
    <>
      <path d="m3 7 2 2 4-4" />
      <path d="m3 17 2 2 4-4" />
      <path d="M13 6h8" />
      <path d="M13 12h8" />
      <path d="M13 18h8" />
    </>
  ),
  files: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </>
  ),
  vault: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 9v6" />
    </>
  ),
};

export function MarketplaceAdminNav({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="admin-nav">
      {ADMIN_NAV_SECTIONS.map((section) => (
        <div key={section.id}>
          <p className="admin-nav__section-label">{section.label}</p>
          <div className="admin-nav__list">
            {section.items.map((item) => {
              const active = navItemActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  title={item.description}
                  className={cn("admin-nav__link", active && "admin-nav__link--active")}
                >
                  <AdminNavIcon name={item.icon} />
                  <span className="admin-nav__label">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function MarketplaceAdminMobileMenuButton({
  onClick,
  open,
}: {
  onClick: () => void;
  open: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="admin-menu-btn"
      aria-expanded={open}
      aria-label={open ? "Close menu" : "Open menu"}
    >
      <svg
        width="20"
        height="20"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        {open ? (
          <path strokeLinecap="round" d="M6 6l12 12M6 18L18 6" />
        ) : (
          <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
        )}
      </svg>
    </button>
  );
}
