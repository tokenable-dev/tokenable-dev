"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/ds/cn";
import { isMarketplaceCollectionDetailPath } from "@/constants/layout";
import type { HeaderNavMinLevel } from "@/lib/auth/accountAccess";
import { useHeaderNavGate } from "@/hooks/auth/useHeaderNavGate";
import { useClientMounted } from "@/hooks/ui/useClientMounted";
import { isSellPrimaryNavActive } from "@/lib/vault/vaultAccess";
import { isPortfolioRoute } from "@/lib/portfolio/portfolioPaths";
import { usePortfolioNavHref } from "@/hooks/portfolio/usePortfolioNavHref";
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
  if (isPrimaryHeaderNavActive(pathname, "/search")) return true;
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
  { id: "markets", href: "/markets", label: "Markets", minLevel: 0 as HeaderNavMinLevel },
  { id: "collection", href: "/portfolio?tab=assets", label: "Collection", minLevel: 1 as HeaderNavMinLevel },
  { id: "sell", href: "/vault", label: "Sell", minLevel: 0 as HeaderNavMinLevel },
] as const;

export function navItemActive(pathname: string | null | undefined, href: string): boolean {
  const hrefPath = stripQueryAndHash(href);
  if (hrefPath === "/markets") return isMarketsPrimaryNavActive(pathname);
  // Sell item points at the hub (`/vault`) but stays active through `/sell/flow` and `/sell/shipping`.
  if (hrefPath === "/sell" || hrefPath === "/vault") return isSellPrimaryNavActive(pathname);
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
  id: string,
  href: string,
  portfolioHref: string,
): string {
  return id === "collection" ? portfolioHref : href;
}

/** Desktop primary nav — visible above GNB mobile breakpoint. */
export function HeaderDesktopNav() {
  const pathname = usePathname();
  const navigate = useHeaderNavGate();
  const portfolioHref = usePortfolioNavHref();
  const t = useTranslations("Nav");

  return (
    <nav className="gnb-nav" aria-label={t("aria")}>
      {HEADER_NAV_ITEMS.map(({ id, href, minLevel }) => {
        const itemHref = resolveNavHref(id, href, portfolioHref);
        return (
          <HeaderNavLink
            key={id}
            href={itemHref}
            label={t(id)}
            minLevel={minLevel}
            active={navItemActive(pathname, itemHref)}
            onNavigate={navigate}
          />
        );
      })}
    </nav>
  );
}

/** Mobile drawer primary nav — Markets / Collection / Sell. */
export function HeaderMobileNav({ onClose }: { onClose: () => void }) {
  const mounted = useClientMounted();
  const initialized = useAuthStore((s) => s.initialized);
  const loading = useAuthStore((s) => s.loading);
  const pathname = usePathname();
  const navigate = useHeaderNavGate();
  const portfolioHref = usePortfolioNavHref();
  const t = useTranslations("Nav");

  if (!mounted || !initialized || loading) {
    return null;
  }

  return (
    <>
      {HEADER_NAV_ITEMS.map(({ id, href, minLevel }) => {
        const itemHref = resolveNavHref(id, href, portfolioHref);
        return (
          <HeaderNavLink
            key={id}
            href={itemHref}
            label={t(id)}
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
