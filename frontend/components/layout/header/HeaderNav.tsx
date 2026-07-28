"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/ds/cn";
import { isMarketplaceCollectionDetailPath } from "@/constants/layout";
import type { HeaderNavMinLevel } from "@/lib/auth/accountAccess";
import { useHeaderNavGate } from "@/hooks/auth/useHeaderNavGate";
import { useClientMounted } from "@/hooks/ui/useClientMounted";
import { isSellPrimaryNavActive } from "@/lib/vault/vaultAccess";
import { useAuthStore } from "@/store/authStore";

/** Exact path or nested routes (strip query/hash before compare). */
function isPrimaryHeaderNavActive(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  let pathOnly = pathname;
  const qIdx = pathOnly.indexOf("?");
  if (qIdx >= 0) pathOnly = pathOnly.slice(0, qIdx);
  const hIdx = pathOnly.indexOf("#");
  if (hIdx >= 0) pathOnly = pathOnly.slice(0, hIdx);
  if (pathOnly === href) return true;
  const base = href.replace(/\/$/, "");
  return pathOnly.startsWith(`${base}/`);
}

function isMarketsPrimaryNavActive(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (isPrimaryHeaderNavActive(pathname, "/markets")) return true;
  if (isMarketplaceCollectionDetailPath(pathname)) return true;
  let pathOnly = pathname;
  const qi = pathOnly.indexOf("?");
  if (qi >= 0) pathOnly = pathOnly.slice(0, qi);
  const hi = pathOnly.indexOf("#");
  if (hi >= 0) pathOnly = pathOnly.slice(0, hi);
  const hub = "/marketplace/other-listings";
  return pathOnly === hub || pathOnly.startsWith(`${hub}/`);
}

export const HEADER_NAV_ITEMS = [
  { href: "/markets", label: "Markets", minLevel: 0 as HeaderNavMinLevel },
  { href: "/portfolio", label: "Portfolio", minLevel: 1 as HeaderNavMinLevel },
  { href: "/sell", label: "Sell", minLevel: 1 as HeaderNavMinLevel },
] as const;

export function visibleHeaderNavItems() {
  return HEADER_NAV_ITEMS;
}

export function navItemActive(pathname: string | null | undefined, href: string): boolean {
  if (href === "/markets") return isMarketsPrimaryNavActive(pathname);
  if (href === "/sell") return isSellPrimaryNavActive(pathname);
  return isPrimaryHeaderNavActive(pathname, href);
}

function HeaderNavLink({
  href,
  label,
  minLevel,
  active,
  onNavigate,
  className,
}: {
  href: string;
  label: string;
  minLevel: HeaderNavMinLevel;
  active: boolean;
  onNavigate: (href: string, minLevel: HeaderNavMinLevel) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(href, minLevel)}
      aria-current={active ? "page" : undefined}
      className={cn("navlink", active && "on", className)}
    >
      {label}
    </button>
  );
}

/** Desktop primary nav — visible above GNB mobile breakpoint. */
export function HeaderDesktopNav() {
  const pathname = usePathname();
  const navigate = useHeaderNavGate();
  const navItems = visibleHeaderNavItems();

  return (
    <nav className="gnb-nav" aria-label="Main">
      {navItems.map(({ href, label, minLevel }) => (
        <HeaderNavLink
          key={href}
          href={href}
          label={label}
          minLevel={minLevel}
          active={navItemActive(pathname, href)}
          onNavigate={navigate}
        />
      ))}
    </nav>
  );
}

/** Mobile drawer primary nav — Markets / Portfolio / Sell (v2 gnb-drawer). */
export function HeaderMobileNav({ onClose }: { onClose: () => void }) {
  const mounted = useClientMounted();
  const initialized = useAuthStore((s) => s.initialized);
  const loading = useAuthStore((s) => s.loading);
  const pathname = usePathname();
  const navigate = useHeaderNavGate();
  const navItems = visibleHeaderNavItems();

  if (!mounted || !initialized || loading) {
    return null;
  }

  return (
    <>
      {navItems.map(({ href, label, minLevel }) => (
        <HeaderNavLink
          key={href}
          href={href}
          label={label}
          minLevel={minLevel}
          active={navItemActive(pathname, href)}
          onNavigate={(h, level) => {
            navigate(h, level);
            onClose();
          }}
        />
      ))}
    </>
  );
}
