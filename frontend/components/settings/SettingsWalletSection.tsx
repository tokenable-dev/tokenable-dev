"use client";

import { useTranslations } from "next-intl";
import { HeaderWalletCopyAddressButton } from "@/components/layout/header/wallet/HeaderWalletCopyAddressButton";
import {
  usePrivyFiatOnramp,
  isPrivyFiatOnrampFeatureEnabled,
} from "@/hooks/wallet/usePrivyFiatOnramp";
import { useAccountWalletSession } from "@/hooks/auth/useAccountWalletSession";
import type { AuthUser } from "@/lib/auth";
import { formatUsdcAmount } from "@/lib/market/displayMoney";
import { useAppStore } from "@/store";
import { SettingsBtn } from "./SettingsBtn";

function formatUsdcBalance(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return formatUsdcAmount(0);
  return formatUsdcAmount(n);
}

export function SettingsWalletSection({ user: _user }: { user: AuthUser }) {
  const t = useTranslations("Settings");
  const tNav = useTranslations("Nav");
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
      <h1 className="tk-settings__sec-h">{t("nav.wallet")}</h1>
      <p className="tk-settings__sec-sub">
        {t("ui.walletSub")}
      </p>

      <div className="tk-settings__card">
        <div className="tk-settings__lbl">{t("ui.available")}</div>
        <div className="tk-settings__balance">
          <span className="tk-settings__balance-amt">
            {formatUsdcBalance(usdcBalanceFormatted)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {showAddFunds ? (
            <SettingsBtn
              variant="primary"
              size="md"
              disabled={!primaryAddress || fundingInFlight || fundingConfigLoading}
              title={
                canStartFunding ? tNav("buyUsdc") : tNav("moonpaySetup")
              }
              onClick={() => void startFunding(primaryAddress)}
            >
              {fundingInFlight ? tNav("openingCheckout") : tNav("addFunds")}
            </SettingsBtn>
          ) : null}
          <SettingsBtn
            variant="ghost"
            size="md"
            disabled
            title={t("ui.withdrawSoon")}
          >
            {t("ui.withdraw")}
          </SettingsBtn>
        </div>
        {fundingError ? (
          <p className="mt-3 text-sm text-[var(--neg)]" role="alert">
            {fundingError}
          </p>
        ) : null}
      </div>

      <div className="tk-settings__card">
        <div className="tk-settings__lbl">{t("ui.walletAddress")}</div>
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
            {t("ui.signInWallet")}
          </p>
        )}
      </div>
    </section>
  );
}
