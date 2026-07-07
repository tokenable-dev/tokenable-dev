"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useHeaderNavGate } from "@/hooks/auth/useHeaderNavGate";
import { useHeaderWalletMenuData } from "@/hooks/auth/useHeaderWalletMenuData";
import { completeSignOut } from "@/lib/auth/signOut";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";
import {
  WalletBidsIcon,
  WalletHistoryIcon,
  WalletNotificationsIcon,
  WalletPortfolioIcon,
  WalletSettingsIcon,
  WalletSignOutIcon,
  WalletUserIcon,
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
}: {
  variant: MenuVariant;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const navigate = useHeaderNavGate();
  const openSignIn = useAuthUiStore((s) => s.openSignIn);
  const logout = useAuthStore((s) => s.logout);
  const { user, displayAddress, kyc, balanceLabel } = useHeaderWalletMenuData();
  const [signingOut, setSigningOut] = useState(false);

  const go = useCallback(
    (href: string, minLevel: 0 | 1 | 2 = 0) => {
      if (minLevel === 0 && !user) {
        openSignIn({ returnTo: href });
        onNavigate?.();
        return;
      }
      if (minLevel === 0) {
        router.push(href);
        onNavigate?.();
        return;
      }
      navigate(href, minLevel);
      onNavigate?.();
    },
    [navigate, onNavigate, openSignIn, router, user],
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
      <button type="button" className={itemClass(variant)} onClick={() => go("/portfolio", 1)}>
        <WalletPortfolioIcon />
        My Portfolio
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
      <button type="button" className={itemClass(variant)} disabled aria-disabled="true">
        <WalletNotificationsIcon />
        Notifications
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
