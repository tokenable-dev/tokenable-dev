"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ADMIN_BTN_GHOST,
  ADMIN_SEGMENT_BTN,
  ADMIN_SEGMENT_BTN_ACTIVE,
} from "./adminUi";
import {
  ADMIN_NAV_ITEMS,
  ADMIN_NAV_SECTIONS,
  isAdminMarketsPreviewActive,
  isAdminNavItemActive,
  type AdminNavItem,
} from "./nav/adminNavConfig";

function navItemActive(pathname: string, item: AdminNavItem): boolean {
  if (item.href === "/marketplace/admin/markets") {
    return isAdminMarketsPreviewActive(pathname);
  }
  return isAdminNavItemActive(pathname, item);
}

export function MarketplaceAdminNav({
  onNavigate,
  compact = false,
}: {
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const pathname = usePathname();

  if (compact) {
    return (
      <div className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ADMIN_NAV_ITEMS.map((item) => {
          const active = navItemActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={active ? ADMIN_SEGMENT_BTN_ACTIVE : ADMIN_SEGMENT_BTN}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <nav className="flex flex-col gap-4 p-3">
      {ADMIN_NAV_SECTIONS.map((section) => (
        <div key={section.id}>
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {section.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = navItemActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  title={item.description}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-zinc-100 font-semibold text-zinc-900 ring-1 ring-zinc-200"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  }`}
                >
                  {item.label}
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
      className={`${ADMIN_BTN_GHOST} lg:hidden`}
      aria-expanded={open}
      aria-label={open ? "Close menu" : "Open menu"}
    >
      <svg
        className="h-5 w-5"
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
