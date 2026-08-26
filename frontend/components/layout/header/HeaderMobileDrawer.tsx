"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useLogin } from "@privy-io/react-auth";
import { useCallback, useEffect, useState } from "react";
import { TkButton } from "@/components/ds";
import {
  HEADER_NAV_ITEMS,
  navItemActive,
} from "@/components/layout/header/HeaderNav";
import {
  MobileDrawerChevronIcon,
  MobileDrawerKycCheckIcon,
  MobileDrawerMarketsIcon,
  MobileDrawerNotificationsIcon,
  MobileDrawerPortfolioIcon,
  MobileDrawerRedeemRequestsIcon,
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
import { NetworkSwitcher } from "@/components/network/NetworkSwitcher";
import { useHeaderNavGate } from "@/hooks/auth/useHeaderNavGate";
import { useHeaderWalletMenuData } from "@/hooks/auth/useHeaderWalletMenuData";
import { useActivePartner } from "@/hooks/partner/useActivePartner";
import { usePrivyInitGate } from "@/hooks/auth/usePrivyInitGate";
import { useMarketplaceNotifications } from "@/hooks/notifications/useMarketplaceNotifications";
import { completeSignOut } from "@/lib/auth/signOut";
import type { HeaderKycTone } from "@/lib/wallet/walletMenuDisplay";
import { cn } from "@/lib/ds/cn";
import {
  isPartnerPortfolioRoute,
  isPortfolioRoute,
  portfolioUrl,
  PARTNER_PORTFOLIO_PATH,
  PORTFOLIO_PATH,
} from "@/lib/portfolio/portfolioPaths";
import { usePortfolioNavHref } from "@/hooks/portfolio/usePortfolioNavHref";
import { useAuthStore } from "@/store/authStore";
import { HeaderWalletCopyAddressButton } from "@/components/layout/header/wallet/HeaderWalletCopyAddressButton";

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
  if (!isPortfolioRoute(pathname)) return false;
  const tab = portfolioTabFromSearch(searchParams);
  return tab == null || tab === "collectibles";
}

function isPortfolioSubActive(
  pathname: string | null | undefined,
  searchParams: URLSearchParams | null,
  tab: "bids" | "history",
): boolean {
  if (!isPortfolioRoute(pathname)) return false;
  return portfolioTabFromSearch(searchParams) === tab;
}

function portfolioBaseForPath(pathname: string | null | undefined): string {
  return isPartnerPortfolioRoute(pathname) ? PARTNER_PORTFOLIO_PATH : PORTFOLIO_PATH;
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
  const { canShowAuthUi, authenticated, privyUnavailable } = usePrivyInitGate();
  const { unreadCount } = useMarketplaceNotifications();
  const initialized = useAuthStore((s) => s.initialized);
  const loading = useAuthStore((s) => s.loading);
  const logout = useAuthStore((s) => s.logout);
  const { walletAddress, displayAddress, kyc, balanceLabel, refetchBalance } = useHeaderWalletMenuData();
  const { isActivePartner } = useActivePartner();
  const portfolioHref = usePortfolioNavHref();
  const portfolioBase = portfolioBaseForPath(pathname);
  const [signingOut, setSigningOut] = useState(false);
  const [portfolioMenuOpen, setPortfolioMenuOpen] = useState(false);

  const sessionPending =
    !canShowAuthUi || (!authenticated && (!initialized || loading) && !privyUnavailable);
  const isLoggedIn = authenticated;
  const showProfile = !sessionPending && isLoggedIn;
  const showConnect = !sessionPending && !isLoggedIn;
  const showProfileSkeleton = sessionPending && isLoggedIn;

  useEffect(() => {
    if (!open || !isLoggedIn) return;
    void refetchBalance();
  }, [open, isLoggedIn, refetchBalance]);

  useEffect(() => {
    if (!open) {
      setPortfolioMenuOpen(false);
      return;
    }
    if (!showProfile) {
      setPortfolioMenuOpen(false);
      return;
    }
    const onPortfolio = isPortfolioRoute(pathname);
    const onBids = isPortfolioSubActive(pathname, searchParams, "bids");
    const onHistory = isPortfolioSubActive(pathname, searchParams, "history");
    if (onPortfolio || onBids || onHistory) setPortfolioMenuOpen(true);
  }, [open, showProfile, pathname, searchParams]);

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
        {showProfileSkeleton ? <MobileDrawerProfileSkeleton /> : null}

        {showProfile ? (
          <div className="tkm-profile">
            <div className="tkm-profile__top">
              <div className="tkm-profile__avatar" aria-hidden>
                <MobileDrawerUserIcon />
              </div>
              <div className="tkm-profile__info">
                <span className="tkm-profile__addr-row">
                  <span className="tkm-profile__addr">{displayAddress}</span>
                  <HeaderWalletCopyAddressButton address={walletAddress} size="sm" />
                </span>
                <span className={cn("tkm-profile__kyc", `tkm-profile__kyc--${kyc.tone}`)}>
                  {kyc.tone === "pos" ? <MobileDrawerKycCheckIcon aria-hidden /> : null}
                  {mobileDrawerKycLabel(kyc.tone, kyc.text)}
                </span>
              </div>
              <span className="tkm-profile__bal">{balanceLabel}</span>
            </div>
            <div className="tkm-profile__network">
              <NetworkSwitcher inDrawer />
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
            const isPortfolio = label === "Portfolio";
            const itemHref = isPortfolio ? portfolioHref : href;
            const itemActive = isPortfolio
              ? isPortfolioMainActive(pathname, searchParams)
              : navItemActive(pathname, itemHref);

            if (isPortfolio && showProfile) {
              return (
                <div key={label} className="tkm-portfolio">
                  <button
                    type="button"
                    className={cn(
                      "tkm-item tkm-item--portfolio",
                      (itemActive ||
                        isPortfolioSubActive(pathname, searchParams, "bids") ||
                        isPortfolioSubActive(pathname, searchParams, "history")) &&
                        "active",
                    )}
                    aria-expanded={portfolioMenuOpen}
                    onClick={() => setPortfolioMenuOpen((v) => !v)}
                  >
                    <Icon aria-hidden />
                    <span className="tkm-item__label">{label}</span>
                    <span
                      className={cn(
                        "tkm-item__chevron",
                        portfolioMenuOpen && "tkm-item__chevron--open",
                      )}
                      aria-hidden
                    >
                      <MobileDrawerChevronIcon />
                    </span>
                  </button>
                  {portfolioMenuOpen ? (
                    <div className="tkm-portfolio__subs" role="group" aria-label="Portfolio">
                      <button
                        type="button"
                        className={cn(
                          "tkm-item tkm-item--sub",
                          isPortfolioMainActive(pathname, searchParams) && "active",
                        )}
                        onClick={() => go(itemHref, minLevel)}
                      >
                        <MobileDrawerPortfolioIcon width={16} height={16} aria-hidden />
                        My Assets
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "tkm-item tkm-item--sub",
                          isPortfolioSubActive(pathname, searchParams, "bids") && "active",
                        )}
                        onClick={() => go(portfolioUrl(portfolioBase, "tab=bids"), 1)}
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
                        onClick={() => go(portfolioUrl(portfolioBase, "tab=history"), 1)}
                      >
                        <WalletHistoryIcon width={16} height={16} aria-hidden />
                        Transaction History
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            }

            return (
              <div key={label}>
                <button
                  type="button"
                  className={cn("tkm-item", itemActive && "active")}
                  onClick={() => go(itemHref, minLevel)}
                >
                  <Icon aria-hidden />
                  {label}
                </button>
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
          {isActivePartner ? (
            <button
              type="button"
              className={cn(
                "tkm-item",
                isSecondaryNavActive(pathname, "/partner/shipments") && "active",
              )}
              onClick={() => go("/partner/shipments", 1)}
            >
              <MobileDrawerRedeemRequestsIcon aria-hidden />
              Redeem requests
            </button>
          ) : null}
          <button
            type="button"
            className={cn("tkm-item", isSecondaryNavActive(pathname, "/settings") && "active")}
            onClick={() => go("/settings")}
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
