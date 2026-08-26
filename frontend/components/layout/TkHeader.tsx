"use client";

import "@/styles/tokenable-wallet-menu.css";
import "@/styles/tokenable-notifications.css";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/ds/cn";
import { ASSETS } from "@/constants/assets";
import { shouldHideAppChrome } from "@/constants/layout";
import { HeaderAuthModals } from "@/components/auth/HeaderAuthModals";
import { HeaderAuthControls } from "@/components/layout/header/HeaderAuthControls";
import { HeaderDesktopNav } from "@/components/layout/header/HeaderNav";
import { HeaderMobileDrawer } from "@/components/layout/header/HeaderMobileDrawer";
import {
  TkHeaderSearch,
  TkHeaderSearchMobileButton,
} from "@/components/layout/header/TkHeaderSearch";
import { NotificationsDrawer } from "@/components/layout/notifications/NotificationsDrawer";
import { NotificationUnreadBadge } from "@/components/layout/notifications/NotificationUnreadBadge";
import { useMarketplaceNotifications } from "@/hooks/notifications/useMarketplaceNotifications";
import { useAuthStore } from "@/store/authStore";

export function TkHeader() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const userId = useAuthStore((s) => s.user?.id ?? "");
  const hideChrome = shouldHideAppChrome(pathname);
  const { unreadCount } = useMarketplaceNotifications({
    // Admin / site-access hide GNB but this hook still ran and polled /api every 15s,
    // which kept `next dev` compiling the proxy route (main local fan culprit).
    enabled: Boolean(userId) && !hideChrome,
  });

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
        )}
      >
        <div className="tk-header__bar">
          <div className="tk-header__left">
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

          <div className="tk-header__center gnb-search-center">
            <TkHeaderSearch
              mobileOpen={mobileSearchOpen}
              onMobileOpenChange={setMobileSearchOpen}
            />
          </div>

          <div className="tk-header__right">
            <div className="tk-header__mobile-actions">
              <TkHeaderSearchMobileButton onClick={openMobileSearch} />

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

            <div className="gnb-right">
              <HeaderAuthControls onOpenNotifications={openNotifications} />
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
