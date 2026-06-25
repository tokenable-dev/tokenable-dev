"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/marketplace/admin/cards", label: "Listed cards" },
  { href: "/marketplace/admin/collections", label: "Collections" },
  { href: "/marketplace/admin/top100", label: "Top 100" },
  { href: "/marketplace/admin/top-movers", label: "Top Movers" },
  { href: "/marketplace/admin/price-webhooks", label: "Price sync" },
] as const;

export function MarketplaceAdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-2 sm:mb-8 sm:gap-3">
      {TABS.map((tab) => {
        const active =
          pathname === tab.href ||
          (tab.href === "/marketplace/admin/top100" &&
            pathname.startsWith("/marketplace/admin/top100")) ||
          (tab.href === "/marketplace/admin/top-movers" &&
            pathname.startsWith("/marketplace/admin/top-movers")) ||
          (tab.href === "/marketplace/admin/price-webhooks" &&
            pathname.startsWith("/marketplace/admin/price-webhooks"));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors sm:px-5 sm:py-3 ${
              active
                ? "bg-amber-500 text-[#0a0a0a] shadow-md shadow-amber-500/20"
                : "border border-zinc-700 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800/80"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
