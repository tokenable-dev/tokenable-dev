"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ADMIN_BTN_GHOST,
  ADMIN_SEGMENT_BTN,
  ADMIN_SEGMENT_BTN_ACTIVE,
} from "./adminUi";

const NAV_ITEMS = [
  { href: "/marketplace/admin", label: "Overview", exact: true },
  { href: "/marketplace/admin/analytics", label: "Analytics" },
  { href: "/marketplace/admin/users", label: "Users", prefix: "/marketplace/admin/users" },
  { href: "/marketplace/admin/cards", label: "Listed cards" },
  { href: "/marketplace/admin/collections", label: "Collections" },
  { href: "/marketplace/admin/top100", label: "Top 100", prefix: "/marketplace/admin/top100" },
  {
    href: "/marketplace/admin/top-movers",
    label: "Top Movers",
    prefix: "/marketplace/admin/top-movers",
  },
  {
    href: "/marketplace/admin/price-webhooks",
    label: "Price sync",
    prefix: "/marketplace/admin/price-webhooks",
  },
] as const;

function isActive(
  pathname: string,
  item: (typeof NAV_ITEMS)[number],
): boolean {
  if ("exact" in item && item.exact) {
    return pathname === item.href;
  }
  if ("prefix" in item && item.prefix) {
    return pathname.startsWith(item.prefix);
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
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
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={
                active ? ADMIN_SEGMENT_BTN_ACTIVE : ADMIN_SEGMENT_BTN
              }
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
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
