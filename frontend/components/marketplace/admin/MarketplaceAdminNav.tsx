"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/marketplace/admin/cards", label: "Listed cards" },
  { href: "/marketplace/admin/collections", label: "Collections" },
] as const;

export function MarketplaceAdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-5 flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
              active
                ? "bg-amber-500/90 text-[#0a0a0a]"
                : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800/80"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
