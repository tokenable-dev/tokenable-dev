"use client";

import { usePathname } from "next/navigation";
import {
  isMarketplaceCollectionDetailPath,
} from "@/constants/layout";
import { type HeaderNavMinLevel } from "@/lib/auth/accountAccess";
import { useHeaderNavGate } from "@/hooks/auth/useHeaderNavGate";

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
  { href: "/vault", label: "Sell", minLevel: 2 as HeaderNavMinLevel },
] as const;

function navItemActive(pathname: string | null | undefined, href: string): boolean {
  if (href === "/markets") return isMarketsPrimaryNavActive(pathname);
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
      className={
        className ??
        `relative flex h-full items-center text-[15px] font-semibold leading-normal tracking-tight transition-colors sm:text-base ${
          active ? "text-mint" : "text-gray-400 hover:text-white"
        }`
      }
    >
      {label}
      {active ? (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-[10px] left-1/2 h-[3px] w-[calc(100%+12px)] max-w-none -translate-x-1/2 rounded-t-[2px] bg-mint sm:bottom-3 sm:rounded-t-[1px]"
        />
      ) : null}
    </button>
  );
}

/** Desktop primary nav — always visible from `sm` up. */
export function HeaderDesktopNav() {
  const pathname = usePathname();
  const navigate = useHeaderNavGate();

  return (
    <nav className="hidden h-full items-center gap-8 sm:ml-1 sm:flex md:ml-3" aria-label="Main">
      {HEADER_NAV_ITEMS.map(({ href, label, minLevel }) => (
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
