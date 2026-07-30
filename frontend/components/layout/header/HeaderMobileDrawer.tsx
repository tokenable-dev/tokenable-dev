"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLogin, usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useState } from "react";
import { TkButton } from "@/components/ds";
import {
  HEADER_NAV_ITEMS,
  navItemActive,
} from "@/components/layout/header/HeaderNav";
import {
  MobileDrawerKycCheckIcon,
  MobileDrawerMarketsIcon,
  MobileDrawerNotificationsIcon,
  MobileDrawerPortfolioIcon,
  MobileDrawerSettingsIcon,
  MobileDrawerSignOutIcon,
  MobileDrawerUserIcon,
  MobileDrawerVaultIcon,
  MobileDrawerWatchlistIcon,
} from "@/components/layout/header/HeaderMobileDrawerIcons";
import {
  WalletBidsIcon,
  WalletHistoryIcon,
} from "@/components/layout/header/wallet/HeaderWalletMenuIcons";
import { NotificationUnreadBadge } from "@/components/layout/notifications/NotificationUnreadBadge";
import { ASSETS } from "@/constants/assets";
import { useHeaderNavGate } from "@/hooks/auth/useHeaderNavGate";
import { useHeaderWalletMenuData } from "@/hooks/auth/useHeaderWalletMenuData";
import { useMarketplaceNotifications } from "@/hooks/notifications/useMarketplaceNotifications";
import { useClientMounted } from "@/hooks/ui/useClientMounted";
import { completeSignOut } from "@/lib/auth/signOut";
import type { HeaderKycTone } from "@/lib/wallet/walletMenuDisplay";
import { cn } from "@/lib/ds/cn";
import { useAuthStore } from "@/store/authStore";

function mobileDrawerKycLabel(tone: HeaderKycTone, text: string): string {
  if (tone === "pos") return "Verified";
  if (text.includes("Pending")) return "Pending";
  if (text.includes("Rejected")) return "Rejected";
  return "Not verified";
}

function isSecondaryNavActive(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  let pathOnly = pathname;
  const qIdx = pathOnly.indexOf("?");
  if (qIdx >= 0) pathOnly = pathOnly.slice(0, qIdx);
  const hIdx = pathOnly.indexOf("#");
  if (hIdx >= 0) pathOnly = pathOnly.slice(0, hIdx);
  if (pathOnly === href) return true;
  return pathOnly.startsWith(`${href}/`);
}

function portfolioTabFromSearch(searchParams: URLSearchParams | null): string | null {
  if (!searchParams) return null;
  const tab = searchParams.get("tab");
  if (tab === "history" || tab === "transaction-history" || tab === "watchlist") {
    return "history";
  }
  if (tab === "bids") return "bids";
  if (tab === "collectibles" || tab === "assets") return "collectibles";
  return tab;
}

function isPortfolioMainActive(
  pathname: string | null | undefined,
  searchParams: URLSearchParams | null,
): boolean {
  if (!isSecondaryNavActive(pathname, "/portfolio")) return false;
  const tab = portfolioTabFromSearch(searchParams);
  return tab == null || tab === "collectibles";
}

function isPortfolioSubActive(
  pathname: string | null | undefined,
  searchParams: URLSearchParams | null,
  tab: "bids" | "history",
): boolean {
  if (!isSecondaryNavActive(pathname, "/portfolio")) return false;
  return portfolioTabFromSearch(searchParams) === tab;
}

const PRIMARY_ICONS = {
  Markets: MobileDrawerMarketsIcon,
  Portfolio: MobileDrawerPortfolioIcon,
  Sell: MobileDrawerVaultIcon,
} as const;

type HeaderMobileDrawerProps = {
  open: boolean;
  onClose: () => void;
  onOpenNotifications?: () => void;
};

function MobileDrawerProfileSkeleton() {
  return (
    <div className="tkm-profile tkm-profile--skeleton" aria-hidden>
      <div className="tkm-profile__top">
        <div className="tkm-profile__avatar tkm-skeleton" />
        <div className="tkm-profile__info">
          <span className="tkm-skeleton tkm-skeleton--addr" />
          <span className="tkm-skeleton tkm-skeleton--kyc" />
        </div>
        <span className="tkm-skeleton tkm-skeleton--bal" />
      </div>
    </div>
  );
}

/** Full-screen mobile nav drawer — tk-mobile-nav.js (tkm-drawer). */
export function HeaderMobileDrawer({
  open,
  onClose,
  onOpenNotifications,
}: HeaderMobileDrawerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navigate = useHeaderNavGate();
  const { login } = useLogin();
  const { ready, authenticated } = usePrivy();
  const { unreadCount } = useMarketplaceNotifications();
  const mounted = useClientMounted();
  const initialized = useAuthStore((s) => s.initialized);
  const loading = useAuthStore((s) => s.loading);
  const logout = useAuthStore((s) => s.logout);
  const { displayAddress, kyc, balanceLabel, refetchBalance } = useHeaderWalletMenuData();
  const [signingOut, setSigningOut] = useState(false);

  const authPending = !mounted || !ready || !initialized || loading;
  const isLoggedIn = authenticated;
  const showProfile = !authPending && isLoggedIn;
  const showConnect = !authPending && !isLoggedIn;
  const showProfileSkeleton = authPending && isLoggedIn;

  useEffect(() => {
    if (!open || !isLoggedIn) return;
    void refetchBalance();
  }, [open, isLoggedIn, refetchBalance]);

  const go = useCallback(
    (href: string, minLevel: 0 | 1 | 2 = 0) => {
      navigate(href, minLevel);
      onClose();
    },
    [navigate, onClose],
  );

  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await completeSignOut(logout);
      onClose();
    } finally {
      setSigningOut(false);
    }
  }, [logout, onClose, signingOut]);

  const handleConnect = () => {
    login();
    onClose();
  };

  return (
    <>
      <div
        className={cn("tkm-overlay", open && "open")}
        aria-hidden={!open}
        onClick={onClose}
      />

      <div
        className={cn("tkm-drawer", open && "open")}
        aria-hidden={!open}
        role="dialog"
        aria-modal={open}
        aria-label="Navigation menu"
      >
        <div className="tkm-header">
          <Link href="/" className="tkm-logo" onClick={onClose} aria-label="Tokenable home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ASSETS.logo.tokenableSymbol} alt="" width={28} height={28} />
          </Link>
          <button type="button" className="tkm-close" aria-label="Close menu" onClick={onClose}>
            &times;
          </button>
        </div>

        {showProfileSkeleton ? <MobileDrawerProfileSkeleton /> : null}

        {showProfile ? (
          <div className="tkm-profile">
            <div className="tkm-profile__top">
              <div className="tkm-profile__avatar" aria-hidden>
                <MobileDrawerUserIcon />
              </div>
              <div className="tkm-profile__info">
                <span className="tkm-profile__addr">{displayAddress}</span>
                <span className={cn("tkm-profile__kyc", `tkm-profile__kyc--${kyc.tone}`)}>
                  {kyc.tone === "pos" ? <MobileDrawerKycCheckIcon aria-hidden /> : null}
                  {mobileDrawerKycLabel(kyc.tone, kyc.text)}
                </span>
              </div>
              <span className="tkm-profile__bal">{balanceLabel}</span>
            </div>
          </div>
        ) : null}

        {showConnect ? (
          <div className="tkm-connect">
            <TkButton
              type="button"
              variant="primary"
              className="tk-connect"
              onClick={handleConnect}
            >
              Connect Wallet
            </TkButton>
          </div>
        ) : null}

        <div className="tkm-divider" />

        <nav className="tkm-nav" aria-label="Main">
          {HEADER_NAV_ITEMS.map(({ href, label, minLevel }) => {
            const Icon = PRIMARY_ICONS[label];
            const isPortfolio = href === "/portfolio";
            const itemActive = isPortfolio
              ? isPortfolioMainActive(pathname, searchParams)
              : navItemActive(pathname, href);

            return (
              <div key={href}>
                <button
                  type="button"
                  className={cn("tkm-item", itemActive && "active")}
                  onClick={() => go(href, minLevel)}
                >
                  <Icon aria-hidden />
                  {label}
                </button>
                {isPortfolio && showProfile ? (
                  <>
                    <button
                      type="button"
                      className={cn(
                        "tkm-item tkm-item--sub",
                        isPortfolioSubActive(pathname, searchParams, "bids") && "active",
                      )}
                      onClick={() => go("/portfolio?tab=bids", 1)}
                    >
                      <WalletBidsIcon width={16} height={16} aria-hidden />
                      Active Bids
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "tkm-item tkm-item--sub",
                        isPortfolioSubActive(pathname, searchParams, "history") && "active",
                      )}
                      onClick={() => go("/portfolio?tab=history", 1)}
                    >
                      <WalletHistoryIcon width={16} height={16} aria-hidden />
                      Transaction History
                    </button>
                  </>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="tkm-divider" />

        <nav className="tkm-nav" aria-label="Account">
          <button
            type="button"
            className={cn("tkm-item", isSecondaryNavActive(pathname, "/watchlist") && "active")}
            onClick={() => go("/watchlist")}
          >
            <MobileDrawerWatchlistIcon aria-hidden />
            Watchlist
          </button>
          <button
            type="button"
            className="tkm-item"
            onClick={() => {
              onClose();
              onOpenNotifications?.();
            }}
          >
            <MobileDrawerNotificationsIcon aria-hidden />
            <span className="tk-notif-menu-label">Notifications</span>
            <NotificationUnreadBadge count={unreadCount} />
          </button>
          <button
            type="button"
            className={cn("tkm-item", isSecondaryNavActive(pathname, "/profile") && "active")}
            onClick={() => go("/profile")}
          >
            <MobileDrawerSettingsIcon aria-hidden />
            Settings
          </button>
        </nav>

        {showProfile ? (
          <>
            <div className="tkm-divider" />
            <button
              type="button"
              className="tkm-signout"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
            >
              <MobileDrawerSignOutIcon aria-hidden />
              {signingOut ? "Signing out…" : "Sign Out"}
            </button>
          </>
        ) : null}
      </div>
    </>
  );
}
