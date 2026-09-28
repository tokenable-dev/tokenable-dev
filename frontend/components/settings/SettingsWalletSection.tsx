"use client";

import { HeaderWalletCopyAddressButton } from "@/components/layout/header/wallet/HeaderWalletCopyAddressButton";
import {
  usePrivyFiatOnramp,
  isPrivyFiatOnrampFeatureEnabled,
} from "@/hooks/wallet/usePrivyFiatOnramp";
import { useAccountWalletSession } from "@/hooks/auth/useAccountWalletSession";
import type { AuthUser } from "@/lib/auth";
import { useAppStore } from "@/store";
import { SettingsBtn } from "./SettingsBtn";

function formatUsdcBalance(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function SettingsWalletSection({ user: _user }: { user: AuthUser }) {
  const usdcBalanceFormatted = useAppStore((s) => s.usdcBalanceFormatted);
  const { primaryAddress } = useAccountWalletSession();
  const {
    startFunding,
    canStart: canStartFunding,
    inFlight: fundingInFlight,
    isLoadingConfig: fundingConfigLoading,
    lastError: fundingError,
  } = usePrivyFiatOnramp();
  const showAddFunds = isPrivyFiatOnrampFeatureEnabled();

  const walletAddress = primaryAddress?.trim() ?? "";

  return (
    <section className="tk-settings__sec">
      <h1 className="tk-settings__sec-h">Wallet &amp; balance</h1>
      <p className="tk-settings__sec-sub">
        Your balance funds bids and purchases, and receives your sale proceeds.
      </p>

      <div className="tk-settings__card">
        <div className="tk-settings__lbl">Available balance</div>
        <div className="tk-settings__balance">
          <span className="tk-settings__balance-amt">
            {formatUsdcBalance(usdcBalanceFormatted)}
          </span>
          <span className="tk-settings__balance-unit">USDC</span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {showAddFunds ? (
            <SettingsBtn
              variant="primary"
              size="md"
              disabled={!primaryAddress || fundingInFlight || fundingConfigLoading}
              title={
                canStartFunding
                  ? "Buy USDC with card, Apple Pay, or Google Pay"
                  : "MoonPay setup required in Privy Dashboard"
              }
              onClick={() => void startFunding(primaryAddress)}
            >
              {fundingInFlight ? "Opening checkout…" : "Add funds"}
            </SettingsBtn>
          ) : null}
          <SettingsBtn
            variant="ghost"
            size="md"
            disabled
            title="Withdraw funds is coming soon"
          >
            Withdraw funds
          </SettingsBtn>
        </div>
        {fundingError ? (
          <p className="mt-3 text-sm text-[var(--neg)]" role="alert">
            {fundingError}
          </p>
        ) : null}
      </div>

      <div className="tk-settings__card">
        <div className="tk-settings__lbl">Wallet address</div>
        {walletAddress ? (
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <span
              className="font-mono text-sm leading-snug text-white break-all"
              title={walletAddress}
            >
              {walletAddress}
            </span>
            <HeaderWalletCopyAddressButton address={walletAddress} size="sm" />
          </div>
        ) : (
          <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--t2)]">
            Sign in with a wallet to see your address.
          </p>
        )}
      </div>
    </section>
  );
}
