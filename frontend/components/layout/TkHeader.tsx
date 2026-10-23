"use client";

import "@/styles/tokenable-wallet-menu.css";
import "@/styles/tokenable-notifications.css";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/ds/cn";
import { ASSETS } from "@/constants/assets";
import { isHomeLandingPath, shouldHideAppChrome } from "@/constants/layout";
import { HeaderAuthModals } from "@/components/auth/HeaderAuthModals";
import { HeaderAuthControls } from "@/components/layout/header/HeaderAuthControls";
import { HeaderDesktopNav } from "@/components/layout/header/HeaderNav";
import { HeaderMobileDrawer } from "@/components/layout/header/HeaderMobileDrawer";
import {
  GNB_SEARCH_OPEN_EVENT,
  TkHeaderSearch,
  TkHeaderSearchMobileButton,
} from "@/components/layout/header/TkHeaderSearch";
import { NotificationsDrawer } from "@/components/layout/notifications/NotificationsDrawer";
import { NotificationUnreadBadge } from "@/components/layout/notifications/NotificationUnreadBadge";
import { useMarketplaceNotifications } from "@/hooks/notifications/useMarketplaceNotifications";
import { useGnbMobile } from "@/hooks/layout/useGnbMobile";
import { useGnbDesktopSearchLayout } from "@/hooks/layout/useGnbDesktopSearchLayout";
export function TkHeader() {
  const pathname = usePathname();
  const gnbMobile = useGnbMobile();
  const {
    barRef,
    leftRef,
    measureRightRef,
    compact: desktopSearchCompact,
    searchLeftPx,
  } = useGnbDesktopSearchLayout(!gnbMobile);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const hideChrome = shouldHideAppChrome(pathname);
  const hideGnbSearch = isHomeLandingPath(pathname);
  const { unreadCount } = useMarketplaceNotifications({
    enabled: !hideChrome,
  });
  const overlaySearch = gnbMobile || desktopSearchCompact;

  const searchPositionStyle = (
    !gnbMobile && searchLeftPx != null
      ? ({
          "--gnb-search-left": `${searchLeftPx}px`,
          "--gnb-search-tx": "0",
        } as CSSProperties)
      : undefined
  );

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const closeNotifications = useCallback(() => setNotificationsOpen(false), []);
  const openNotifications = useCallback(() => {
    setDrawerOpen(false);
    setNotificationsOpen(true);
  }, []);
  const openMobileSearch = useCallback(() => {
    // Drawer sits at z-8001; leave it open and the burger/header peek above search.
    setDrawerOpen(false);
    setNotificationsOpen(false);
    setMobileSearchOpen(true);
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
    setMobileSearchOpen(false);
    setNotificationsOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onOpenSearch = () => {
      setDrawerOpen(false);
      setNotificationsOpen(false);
      setMobileSearchOpen(true);
    };
    window.addEventListener(GNB_SEARCH_OPEN_EVENT, onOpenSearch);
    return () => window.removeEventListener(GNB_SEARCH_OPEN_EVENT, onOpenSearch);
  }, []);

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
    return null;
  }

  return (
    <>
      <HeaderAuthModals />
      <header
        className={cn(
          "tk-header",
          drawerOpen && "tk-header--drawer-open",
          mobileSearchOpen && "tk-header--search-open",
          desktopSearchCompact && "tk-header--search-compact",
          hideGnbSearch && "tk-header--landing-no-search",
        )}
        style={searchPositionStyle}
      >
        <div className="tk-header__bar" ref={barRef}>
          <div className="tk-header__left" ref={leftRef}>
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
          </div>

          {!hideGnbSearch ? (
            <div className="tk-header__center gnb-search-center">
              <Suspense fallback={<div className="gnb-search-skel" aria-hidden />}>
                <TkHeaderSearch
                  mobileOpen={mobileSearchOpen}
                  onMobileOpenChange={setMobileSearchOpen}
                  overlayMode={overlaySearch}
                />
              </Suspense>
            </div>
          ) : null}

          <div className="tk-header__right">
            <div className="tk-header__mobile-actions">
              {!hideGnbSearch ? (
                <TkHeaderSearchMobileButton onClick={openMobileSearch} />
              ) : null}

              <button
                type="button"
                className={cn("gnb-burger", drawerOpen && "is-open")}
                aria-label={
                  drawerOpen
                    ? "Close menu"
                    : unreadCount > 0
                      ? `Open menu, ${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                      : "Open menu"
                }
                aria-expanded={drawerOpen}
                onClick={() => setDrawerOpen((o) => !o)}
              >
                <span className="burger-lines">
                  <span />
                  <span />
                </span>
                {!drawerOpen ? (
                  <NotificationUnreadBadge count={unreadCount} floating />
                ) : null}
              </button>
            </div>

            {desktopSearchCompact && !hideGnbSearch ? (
              <TkHeaderSearchMobileButton
                className="gnb-search-desktop-fallback"
                onClick={openMobileSearch}
              />
            ) : null}

            <div className="gnb-right" ref={measureRightRef}>
              <Suspense
                fallback={
                  <div className="gnb-auth-skeleton animate-pulse" aria-hidden />
                }
              >
                <HeaderAuthControls onOpenNotifications={openNotifications} />
              </Suspense>
            </div>
          </div>
        </div>
      </header>

      <Suspense fallback={null}>
        <HeaderMobileDrawer
          open={drawerOpen}
          onClose={closeDrawer}
          onOpenNotifications={openNotifications}
        />
      </Suspense>

      <NotificationsDrawer open={notificationsOpen} onClose={closeNotifications} />
    </>
  );
}
