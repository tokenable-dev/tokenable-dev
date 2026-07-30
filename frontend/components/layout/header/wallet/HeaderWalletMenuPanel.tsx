"use client";

import { useCallback, useState } from "react";
import { useHeaderNavGate } from "@/hooks/auth/useHeaderNavGate";
import { useHeaderWalletMenuData } from "@/hooks/auth/useHeaderWalletMenuData";
import {
  isPrivyFiatOnrampFeatureEnabled,
  usePrivyFiatOnramp,
} from "@/hooks/wallet/usePrivyFiatOnramp";
import { isKycComplete } from "@/lib/auth/accountAccess";
import { completeSignOut } from "@/lib/auth/signOut";
import { useAuthStore } from "@/store/authStore";
import { NotificationUnreadBadge } from "@/components/layout/notifications/NotificationUnreadBadge";
import { useMarketplaceNotifications } from "@/hooks/notifications/useMarketplaceNotifications";
import {
  WalletAddFundsIcon,
  WalletBidsIcon,
  WalletHistoryIcon,
  WalletNotificationsIcon,
  WalletPortfolioIcon,
  WalletSettingsIcon,
  WalletSignOutIcon,
  WalletUserIcon,
  WalletVerifyIcon,
  WalletWatchlistIcon,
} from "./HeaderWalletMenuIcons";

type MenuVariant = "dropdown" | "mobile";

function itemClass(variant: MenuVariant, sub?: boolean): string {
  if (variant === "mobile") {
    return sub ? "tk-mw-link tk-mw-link--sub" : "tk-mw-link";
  }
  return sub ? "tk-wd-item tk-wd-sub" : "tk-wd-item";
}

export function HeaderWalletMenuPanel({
  variant,
  onNavigate,
  onOpenNotifications,
}: {
  variant: MenuVariant;
  onNavigate?: () => void;
  onOpenNotifications?: () => void;
}) {
  const navigate = useHeaderNavGate();
  const logout = useAuthStore((s) => s.logout);
  const { walletAddress, displayAddress, kyc, balanceLabel, refetchBalance, user } =
    useHeaderWalletMenuData();
  const { unreadCount } = useMarketplaceNotifications();
  const {
    startFunding,
    inFlight: fundingInFlight,
    lastError: fundingError,
    canStart: canStartFunding,
    isLoadingConfig: fundingConfigLoading,
  } = usePrivyFiatOnramp({ onComplete: () => void refetchBalance() });
  const [signingOut, setSigningOut] = useState(false);
  const showAddFunds = isPrivyFiatOnrampFeatureEnabled();
  const showVerifyIdentity = !isKycComplete(user);

  const go = useCallback(
    (href: string, minLevel: 0 | 1 | 2 = 0) => {
      navigate(href, minLevel);
      onNavigate?.();
    },
    [navigate, onNavigate],
  );

  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await completeSignOut(logout);
      onNavigate?.();
    } finally {
      setSigningOut(false);
    }
  }, [logout, onNavigate, signingOut]);

  const handleAddFunds = useCallback(() => {
    void startFunding(walletAddress).then((ok) => {
      if (ok) onNavigate?.();
    });
  }, [onNavigate, startFunding, walletAddress]);

  const userInfo = (
    <div className="tk-wallet-user">
      <div className="tk-wallet-user__row">
        <span className="tk-wallet-user__avatar" aria-hidden>
          <WalletUserIcon />
        </span>
        <div className="tk-wallet-user__meta">
          <div className="tk-wallet-user__addr">{displayAddress}</div>
          <div className={`tk-wallet-user__kyc tk-wallet-user__kyc--${kyc.tone}`}>{kyc.text}</div>
        </div>
        {variant === "mobile" ? (
          <div className="tk-wallet-user__balance mono">{balanceLabel}</div>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      {userInfo}
      {showAddFunds ? (
        <>
          <button
            type="button"
            className={`${itemClass(variant)} tk-wd-item--funds`}
            onClick={handleAddFunds}
            disabled={!walletAddress || fundingInFlight || fundingConfigLoading}
            title={
              canStartFunding
                ? "Buy USDC with card, Apple Pay, or Google Pay"
                : "MoonPay setup required in Privy Dashboard"
            }
          >
            <WalletAddFundsIcon />
            {fundingInFlight ? "Opening checkout…" : "Add funds"}
          </button>
          {fundingError ? (
            <p className="tk-wd-funds-error" role="alert">
              {fundingError}
            </p>
          ) : null}
          <div className="tk-wd-divider" />
        </>
      ) : null}
      <button type="button" className={itemClass(variant)} onClick={() => go("/portfolio", 1)}>
        <WalletPortfolioIcon />
        Portfolio
      </button>
      <button
        type="button"
        className={itemClass(variant, true)}
        onClick={() => go("/portfolio?tab=bids", 1)}
      >
        <WalletBidsIcon />
        Active Bids
      </button>
      <button
        type="button"
        className={itemClass(variant, true)}
        onClick={() => go("/portfolio?tab=history", 1)}
      >
        <WalletHistoryIcon />
        Transaction History
      </button>
      <button type="button" className={itemClass(variant)} onClick={() => go("/watchlist")}>
        <WalletWatchlistIcon />
        Watchlist
      </button>
      {showVerifyIdentity ? (
        <button type="button" className={itemClass(variant)} onClick={() => go("/kyc", 1)}>
          <WalletVerifyIcon />
          Verify Identity
        </button>
      ) : null}
      <button
        type="button"
        className={itemClass(variant)}
        onClick={() => {
          onOpenNotifications?.();
          onNavigate?.();
        }}
      >
        <WalletNotificationsIcon />
        <span className="tk-notif-menu-label">Notifications</span>
        <NotificationUnreadBadge count={unreadCount} />
      </button>
      <button type="button" className={itemClass(variant)} onClick={() => go("/profile")}>
        <WalletSettingsIcon />
        Settings
      </button>
      <div className="tk-wd-divider" />
      <button
        type="button"
        className={`${itemClass(variant)} tk-wallet-disconnect`}
        onClick={() => void handleSignOut()}
        disabled={signingOut}
      >
        <WalletSignOutIcon />
        {signingOut ? "Signing out…" : "Sign Out"}
      </button>
    </>
  );
}
