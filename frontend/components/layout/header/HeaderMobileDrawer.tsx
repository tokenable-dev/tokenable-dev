"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TkButton } from "@/components/ds";
import {
  useDisplayFx,
  useSelectDisplayCurrency,
  useSelectLocale,
} from "@/components/i18n/DisplayPreferencesProvider";
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
  WalletAddFundsIcon,
  WalletBidsIcon,
  WalletHistoryIcon,
} from "@/components/layout/header/wallet/HeaderWalletMenuIcons";
import {
  isPrivyFiatOnrampFeatureEnabled,
  usePrivyFiatOnramp,
} from "@/hooks/wallet/usePrivyFiatOnramp";
import { NotificationUnreadBadge } from "@/components/layout/notifications/NotificationUnreadBadge";
import { NetworkSwitcher } from "@/components/network/NetworkSwitcher";
import { useHeaderNavGate } from "@/hooks/auth/useHeaderNavGate";
import { useHeaderWalletMenuData } from "@/hooks/auth/useHeaderWalletMenuData";
import { useActivePartner } from "@/hooks/partner/useActivePartner";
import { usePrivyInitGate } from "@/hooks/auth/usePrivyInitGate";
import { useMarketplaceNotifications } from "@/hooks/notifications/useMarketplaceNotifications";
import { completeSignOut, resolveAuthReturnTo } from "@/lib/auth";
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
import { useAuthUiStore } from "@/store/authUiStore";
import { HeaderWalletCopyAddressButton } from "@/components/layout/header/wallet/HeaderWalletCopyAddressButton";
import {
  CURRENCY_OPTIONS,
  LOCALE_OPTIONS,
  resolveLocale,
  type AppLocale,
  type DisplayCurrency,
} from "@/lib/i18n/preferences";

const MOBILE_LOCALE_ORDER: AppLocale[] = ["en", "zh-CN", "zh-TW", "ja"];

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

function PrefChevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PrefBackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 5l-7 7 7 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PrefCloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PrefSearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16.5L20 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function portfolioBaseForPath(pathname: string | null | undefined): string {
  return isPartnerPortfolioRoute(pathname) ? PARTNER_PORTFOLIO_PATH : PORTFOLIO_PATH;
}

const PRIMARY_ICONS = {
  markets: MobileDrawerMarketsIcon,
  collection: MobileDrawerPortfolioIcon,
  sell: MobileDrawerVaultIcon,
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
  const openSignIn = useAuthUiStore((s) => s.openSignIn);
  const { canShowAuthUi, authenticated, privyUnavailable } = usePrivyInitGate();
  const { unreadCount } = useMarketplaceNotifications();
  const initialized = useAuthStore((s) => s.initialized);
  const loading = useAuthStore((s) => s.loading);
  const logout = useAuthStore((s) => s.logout);
  const { walletAddress, displayAddress, kyc, balanceLabel, refetchBalance } = useHeaderWalletMenuData();
  const {
    startFunding,
    inFlight: fundingInFlight,
    lastError: fundingError,
    canStart: canStartFunding,
    isLoadingConfig: fundingConfigLoading,
  } = usePrivyFiatOnramp({ onComplete: () => void refetchBalance() });
  const showAddFunds = isPrivyFiatOnrampFeatureEnabled();
  const { isActivePartner } = useActivePartner();
  const portfolioHref = usePortfolioNavHref();
  const t = useTranslations("Nav");
  const tAuth = useTranslations("Auth");
  const tLocale = useTranslations("Locale");
  const portfolioBase = portfolioBaseForPath(pathname);
  const [signingOut, setSigningOut] = useState(false);
  const [portfolioMenuOpen, setPortfolioMenuOpen] = useState(false);
  const [pane, setPane] = useState<"menu" | "language" | "currency">("menu");
  const [currencyQuery, setCurrencyQuery] = useState("");
  const currencySearchRef = useRef<HTMLInputElement>(null);
  const fx = useDisplayFx();
  const selectCurrency = useSelectDisplayCurrency();
  const selectLocale = useSelectLocale();
  const activeLocale = resolveLocale(useLocale());
  const activeLanguage =
    LOCALE_OPTIONS.find((row) => row.code === activeLocale) ?? LOCALE_OPTIONS[0];
  const selectedCurrency =
    CURRENCY_OPTIONS.find((row) => row.code === fx.currency) ?? CURRENCY_OPTIONS[0];
  const filteredCurrencies = useMemo(() => {
    const q = currencyQuery.trim().toLowerCase();
    if (!q) return CURRENCY_OPTIONS;
    return CURRENCY_OPTIONS.filter(
      (row) =>
        row.code.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        row.chip.toLowerCase().includes(q),
    );
  }, [currencyQuery]);
  const mobileLocales = MOBILE_LOCALE_ORDER.map(
    (code) => LOCALE_OPTIONS.find((row) => row.code === code) ?? LOCALE_OPTIONS[0],
  );

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
      setPane("menu");
      setCurrencyQuery("");
      return;
    }
    const onPortfolio = isPortfolioRoute(pathname);
    const onBids = isPortfolioSubActive(pathname, searchParams, "bids");
    const onHistory = isPortfolioSubActive(pathname, searchParams, "history");
    if (onPortfolio || onBids || onHistory) setPortfolioMenuOpen(true);
  }, [open, pathname, searchParams]);

  useEffect(() => {
    if (open && pane === "currency") currencySearchRef.current?.focus();
  }, [open, pane]);

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
    openSignIn({ returnTo: resolveAuthReturnTo(pathname, searchParams) });
    // Close drawer after sign-in is queued — avoids trapping Privy under scroll lock on iOS.
    queueMicrotask(() => onClose());
  };

  const handleAddFunds = useCallback(() => {
    void startFunding(walletAddress).then((ok) => {
      if (ok) onClose();
    });
  }, [onClose, startFunding, walletAddress]);

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
            {showAddFunds ? (
              <div className="tkm-profile__funds">
                <button
                  type="button"
                  className="tkm-item tk-wd-item--funds tkm-item--funds"
                  onClick={handleAddFunds}
                  disabled={!walletAddress || fundingInFlight || fundingConfigLoading}
                  title={
                    canStartFunding ? t("buyUsdc") : t("moonpaySetup")
                  }
                >
                  <WalletAddFundsIcon aria-hidden />
                  {fundingInFlight ? t("openingCheckout") : t("addFunds")}
                </button>
                {fundingError ? (
                  <p className="tk-wd-funds-error tkm-funds-error" role="alert">
                    {fundingError}
                  </p>
                ) : null}
              </div>
            ) : null}
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
              {tAuth("connectWallet")}
            </TkButton>
          </div>
        ) : null}

        <div className="tkm-divider" />

        <nav className="tkm-nav" aria-label={t("aria")}>
          {HEADER_NAV_ITEMS.map(({ id, href, minLevel }) => {
            const Icon = PRIMARY_ICONS[id];
            const isPortfolio = id === "collection";
            const itemHref = isPortfolio ? portfolioHref : href;
            const itemActive = isPortfolio
              ? isPortfolioMainActive(pathname, searchParams)
              : navItemActive(pathname, itemHref);

            if (isPortfolio) {
              return (
                <div key={id} className="tkm-portfolio">
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
                    <span className="tkm-item__label">{t(id)}</span>
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
                    <div className="tkm-portfolio__subs" role="group" aria-label={t("collection")}>
                      <button
                        type="button"
                        className={cn(
                          "tkm-item tkm-item--sub",
                          isPortfolioMainActive(pathname, searchParams) && "active",
                        )}
                        onClick={() => go(itemHref, minLevel)}
                      >
                        <MobileDrawerPortfolioIcon width={16} height={16} aria-hidden />
                        {t("items")}
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
                        {t("bids")}
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
                        {t("transactions")}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            }

            return (
              <div key={id}>
                <button
                  type="button"
                  className={cn("tkm-item", itemActive && "active")}
                  onClick={() => go(itemHref, minLevel)}
                >
                  <Icon aria-hidden />
                  {t(id)}
                </button>
              </div>
            );
          })}
        </nav>

        <div className="tkm-divider" />

        <nav className="tkm-nav" aria-label={t("account")}>
          <button
            type="button"
            className={cn("tkm-item", isSecondaryNavActive(pathname, "/watchlist") && "active")}
            onClick={() => go("/watchlist")}
          >
            <MobileDrawerWatchlistIcon aria-hidden />
            {t("watchlist")}
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
            <span className="tk-notif-menu-label">{t("notifications")}</span>
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
              {t("redeemRequests")}
            </button>
          ) : null}
          <button
            type="button"
            className={cn("tkm-item", isSecondaryNavActive(pathname, "/settings") && "active")}
            onClick={() => go("/settings")}
          >
            <MobileDrawerSettingsIcon aria-hidden />
            {t("settings")}
          </button>
        </nav>

        <div className="tkm-divider" />
        <button type="button" className="tkm-pref-row" onClick={() => setPane("language")}>
          <span className="tkm-pref-row__key">{tLocale("language")}</span>
          <span className="tkm-pref-row__value">
            <span className="tkm-pref-row__flag" aria-hidden>
              {activeLanguage.flag}
            </span>
            {activeLanguage.name}
            <PrefChevron />
          </span>
        </button>
        <button type="button" className="tkm-pref-row" onClick={() => setPane("currency")}>
          <span className="tkm-pref-row__key">{tLocale("currency")}</span>
          <span className="tkm-pref-row__value">
            <span className="tkm-pref-row__mark" aria-hidden>
              {selectedCurrency.chip}
            </span>
            {fx.currency}
            <PrefChevron />
          </span>
        </button>

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
              {signingOut ? t("signingOut") : t("signOut")}
            </button>
          </>
        ) : null}
      </div>

      {open && pane !== "menu" && typeof document !== "undefined"
        ? createPortal(
            <div
              className="tkm-pref"
              role="dialog"
              aria-modal="true"
              aria-label={pane === "language" ? tLocale("language") : tLocale("currency")}
            >
              <div className="tkm-pref__bar">
                <button
                  type="button"
                  className="tkm-pref__back"
                  aria-label={tLocale("back")}
                  onClick={() => {
                    setPane("menu");
                    setCurrencyQuery("");
                  }}
                >
                  <PrefBackIcon />
                </button>
                <div className="tkm-pref__title">
                  {pane === "language" ? tLocale("language") : tLocale("currency")}
                </div>
                <button
                  type="button"
                  className="tkm-pref__close"
                  aria-label={tLocale("close")}
                  onClick={() => {
                    setPane("menu");
                    setCurrencyQuery("");
                    onClose();
                  }}
                >
                  <PrefCloseIcon />
                </button>
              </div>

              {pane === "currency" ? (
                <label className="tkm-pref__search">
                  <PrefSearchIcon />
                  <input
                    ref={currencySearchRef}
                    value={currencyQuery}
                    onChange={(event) => setCurrencyQuery(event.target.value)}
                    placeholder={tLocale("search")}
                    aria-label={tLocale("search")}
                    autoComplete="off"
                  />
                </label>
              ) : null}

              {pane === "currency" && filteredCurrencies.length === 0 ? (
                <p className="tkm-pref__empty">{tLocale("empty")}</p>
              ) : (
                <div
                  className="tkm-pref__list"
                  role="listbox"
                  aria-label={pane === "language" ? tLocale("language") : tLocale("currency")}
                >
                  {pane === "language"
                    ? mobileLocales.map((row) => (
                        <button
                          key={row.code}
                          type="button"
                          role="option"
                          aria-selected={row.code === activeLocale}
                          className="tkm-pref__option"
                          onClick={() => {
                            selectLocale(row.code);
                            onClose();
                          }}
                        >
                          <span className="tkm-pref__flag" aria-hidden>
                            {row.flag}
                          </span>
                          <span className="tkm-pref__name">{row.name}</span>
                        </button>
                      ))
                    : filteredCurrencies.map((row) => (
                        <button
                          key={row.code}
                          type="button"
                          role="option"
                          aria-selected={row.code === fx.currency}
                          className="tkm-pref__option"
                          onClick={() => {
                            selectCurrency(row.code as DisplayCurrency);
                            onClose();
                          }}
                        >
                          <span className="tkm-pref__chip" aria-hidden>
                            {row.chip}
                          </span>
                          <span className="tkm-pref__code">{row.code}</span>
                          <span className="tkm-pref__fullname">{row.name}</span>
                        </button>
                      ))}
                </div>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
