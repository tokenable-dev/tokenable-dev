"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/ds/cn";
import { isMarketplaceCollectionDetailPath } from "@/constants/layout";
import type { HeaderNavMinLevel } from "@/lib/auth/accountAccess";
import { useHeaderNavGate } from "@/hooks/auth/useHeaderNavGate";
import { useClientMounted } from "@/hooks/ui/useClientMounted";
import { isSellPrimaryNavActive } from "@/lib/vault/vaultAccess";
import { isPortfolioRoute } from "@/lib/portfolio/portfolioPaths";
import { usePortfolioNavHref } from "@/hooks/portfolio/usePortfolioNavHref";
import { useActivePartner } from "@/hooks/partner/useActivePartner";
import { useAuthStore } from "@/store/authStore";

function stripQueryAndHash(path: string): string {
  let pathOnly = path;
  const qIdx = pathOnly.indexOf("?");
  if (qIdx >= 0) pathOnly = pathOnly.slice(0, qIdx);
  const hIdx = pathOnly.indexOf("#");
  if (hIdx >= 0) pathOnly = pathOnly.slice(0, hIdx);
  return pathOnly;
}

/** Exact path or nested routes (strip query/hash before compare). */
function isPrimaryHeaderNavActive(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  const pathOnly = stripQueryAndHash(pathname);
  const hrefPath = stripQueryAndHash(href);
  if (pathOnly === hrefPath) return true;
  const base = hrefPath.replace(/\/$/, "");
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
  { href: "/portfolio?tab=assets", label: "Portfolio", minLevel: 1 as HeaderNavMinLevel },
  { href: "/vault", label: "Sell", minLevel: 0 as HeaderNavMinLevel },
] as const;

export const PARTNER_HEADER_NAV_ITEM = {
  href: "/partner/shipments",
  label: "Redeem requests",
  minLevel: 1 as HeaderNavMinLevel,
} as const;

export function visibleHeaderNavItems(isActivePartner = false, onPartnerRoute = false) {
  if (!isActivePartner && !onPartnerRoute) return HEADER_NAV_ITEMS;
  return [...HEADER_NAV_ITEMS, PARTNER_HEADER_NAV_ITEM];
}

export function navItemActive(pathname: string | null | undefined, href: string): boolean {
  const hrefPath = stripQueryAndHash(href);
  if (hrefPath === "/markets") return isMarketsPrimaryNavActive(pathname);
  if (hrefPath === "/sell") return isSellPrimaryNavActive(pathname);
  if (hrefPath === "/portfolio") return isPortfolioRoute(pathname);
  if (hrefPath === "/partner/shipments") {
    return pathname?.startsWith("/partner/shipments") ?? false;
  }
  return isPrimaryHeaderNavActive(pathname, hrefPath);
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

function resolveNavHref(
  label: string,
  href: string,
  portfolioHref: string,
): string {
  return label === "Portfolio" ? portfolioHref : href;
}

/** Desktop primary nav — visible above GNB mobile breakpoint. */
export function HeaderDesktopNav() {
  const pathname = usePathname();
  const navigate = useHeaderNavGate();
  const portfolioHref = usePortfolioNavHref();
  const { isActivePartner } = useActivePartner();
  const onPartnerRoute = pathname?.startsWith("/partner") ?? false;
  const navItems = visibleHeaderNavItems(isActivePartner, onPartnerRoute);

  return (
    <nav className="gnb-nav" aria-label="Main">
      {navItems.map(({ href, label, minLevel }) => {
        const itemHref = resolveNavHref(label, href, portfolioHref);
        return (
          <HeaderNavLink
            key={label}
            href={itemHref}
            label={label}
            minLevel={minLevel}
            active={navItemActive(pathname, itemHref)}
            onNavigate={navigate}
          />
        );
      })}
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
  const portfolioHref = usePortfolioNavHref();
  const { isActivePartner } = useActivePartner();
  const onPartnerRoute = pathname?.startsWith("/partner") ?? false;
  const navItems = visibleHeaderNavItems(isActivePartner, onPartnerRoute);

  if (!mounted || !initialized || loading) {
    return null;
  }

  return (
    <>
      {navItems.map(({ href, label, minLevel }) => {
        const itemHref = resolveNavHref(label, href, portfolioHref);
        return (
          <HeaderNavLink
            key={label}
            href={itemHref}
            label={label}
            minLevel={minLevel}
            active={navItemActive(pathname, itemHref)}
            onNavigate={(h, level) => {
              navigate(h, level);
              onClose();
            }}
          />
        );
      })}
    </>
  );
}
