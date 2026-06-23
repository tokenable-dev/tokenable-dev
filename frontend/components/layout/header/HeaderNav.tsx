"use client";

import { useCallback, useEffect, useState } from "react";
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

/** Mobile nav sheet — hamburger on narrow viewports. */
export function HeaderMobileNav() {
  const pathname = usePathname();
  const navigate = useHeaderNavGate();
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleNavigate = useCallback(
    (href: string, minLevel: HeaderNavMinLevel) => {
      close();
      navigate(href, minLevel);
    },
    [close, navigate],
  );

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-800/60 bg-gray-950/90 text-gray-300 transition-colors hover:border-gray-700/70 hover:text-white"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[120] flex flex-col bg-gray-950/98 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-gray-800/80 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
            <p className="text-sm font-semibold text-white">Menu</p>
            <button
              type="button"
              onClick={close}
              className="rounded-lg px-2 py-2 text-sm text-zinc-400 hover:text-white"
            >
              Close
            </button>
          </div>
          <nav className="flex flex-col px-2 py-3" aria-label="Main">
            {HEADER_NAV_ITEMS.map(({ href, label, minLevel }) => {
              const active = navItemActive(pathname, href);
              return (
                <HeaderNavLink
                  key={href}
                  href={href}
                  label={label}
                  minLevel={minLevel}
                  active={active}
                  onNavigate={handleNavigate}
                  className={`w-full rounded-xl px-4 py-3.5 text-left text-base font-semibold transition-colors ${
                    active ? "bg-mint/10 text-mint" : "text-gray-300 hover:bg-gray-800/50 hover:text-white"
                  }`}
                />
              );
            })}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
