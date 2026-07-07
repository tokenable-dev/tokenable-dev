"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/ds/cn";
import { ASSETS } from "@/constants/assets";
import { isMarketplaceCollectionDetailPath } from "@/constants/layout";
import { HeaderAuthModals } from "@/components/auth/HeaderAuthModals";
import { HeaderAuthControls } from "@/components/layout/header/HeaderAuthControls";
import { HeaderDesktopNav, HeaderMobileNav } from "@/components/layout/header/HeaderNav";
import { HeaderMobileWalletSection } from "@/components/layout/header/wallet/HeaderMobileWalletSection";
import {
  TkHeaderSearch,
  TkHeaderSearchMobileButton,
} from "@/components/layout/header/TkHeaderSearch";
import { NetworkSwitcher } from "@/components/network/NetworkSwitcher";

function shouldHideChrome(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname === "/site-access" || pathname.startsWith("/site-access/")) return true;
  if (pathname.startsWith("/marketplace/admin")) return true;
  return false;
}

export function TkHeader() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const hideChrome = shouldHideChrome(pathname);
  const isCollectionDetailHeader = isMarketplaceCollectionDetailPath(pathname);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    setDrawerOpen(false);
    setMobileSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;

    const html = document.documentElement;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;

    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    html.classList.add("gnb-drawer-open");
    document.body.classList.add("gnb-drawer-open");

    return () => {
      html.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      html.classList.remove("gnb-drawer-open");
      document.body.classList.remove("gnb-drawer-open");
    };
  }, [drawerOpen]);

  if (hideChrome) {
    return <HeaderAuthModals />;
  }

  return (
    <>
      <HeaderAuthModals />
      <header className={cn("tk-header", drawerOpen && "tk-header--drawer-open")}>
        <div className="tk-header__bar">
          <Link href="/" className="flex shrink-0 items-center" aria-label="Tokenable home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ASSETS.logo.tokenableDs}
              alt="Tokenable"
              className="tk-header__logo-full"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ASSETS.logo.tokenableSymbol}
              alt="Tokenable"
              className="tk-header__logo-symbol"
            />
          </Link>

          <HeaderDesktopNav />

          <div className="tk-header__spacer" aria-hidden />

          <TkHeaderSearchMobileButton onClick={() => setMobileSearchOpen(true)} />

          <button
            type="button"
            className={cn("gnb-burger", drawerOpen && "is-open")}
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((o) => !o)}
          >
            <span className="burger-lines">
              <span />
              <span />
            </span>
          </button>

          <div className="gnb-right">
            <TkHeaderSearch
              compact={isCollectionDetailHeader}
              mobileOpen={mobileSearchOpen}
              onMobileOpenChange={setMobileSearchOpen}
            />
            <NetworkSwitcher />
            <HeaderAuthControls />
          </div>
        </div>
      </header>

      <div
        className={cn("gnb-drawer", drawerOpen && "open")}
        aria-hidden={!drawerOpen}
        onWheel={(e) => {
          if (!drawerOpen) return;
          e.stopPropagation();
        }}
      >
        <HeaderMobileNav onClose={closeDrawer} />
        <HeaderMobileWalletSection onClose={closeDrawer} />
        <div className="gnb-drawer__footer">
          <NetworkSwitcher inDrawer />
          <HeaderAuthControls placement="drawer" />
        </div>
      </div>
    </>
  );
}
