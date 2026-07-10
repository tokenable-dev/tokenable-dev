"use client";

import "@/styles/tokenable-wallet-menu.css";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/ds/cn";
import { ASSETS } from "@/constants/assets";
import { isMarketplaceCollectionDetailPath } from "@/constants/layout";
import { HeaderAuthModals } from "@/components/auth/HeaderAuthModals";
import { HeaderAuthControls } from "@/components/layout/header/HeaderAuthControls";
import { HeaderDesktopNav } from "@/components/layout/header/HeaderNav";
import { HeaderMobileDrawer } from "@/components/layout/header/HeaderMobileDrawer";
import {
  TkHeaderSearch,
  TkHeaderSearchMobileButton,
} from "@/components/layout/header/TkHeaderSearch";
import { NetworkSwitcher } from "@/components/network/NetworkSwitcher";

function shouldHideChrome(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname === "/site-access" || pathname.startsWith("/site-access/")) return true;
  if (pathname.startsWith("/marketplace/admin")) return true;
  if (pathname.startsWith("/dev/design-system")) return true;
  if (pathname.startsWith("/dev/admin-ui")) return true;
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
              width={184}
              height={24}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ASSETS.logo.tokenableSymbol}
              alt="Tokenable"
              className="tk-header__logo-symbol"
              width={26}
              height={26}
            />
          </Link>

          <HeaderDesktopNav />

          <div className="tk-header__spacer" aria-hidden />

          <div className="tk-header__mobile-actions">
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
          </div>

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

      <Suspense fallback={null}>
        <HeaderMobileDrawer open={drawerOpen} onClose={closeDrawer} />
      </Suspense>
    </>
  );
}
