"use client";

import { useState } from "react";
import { useExportWallet, useWallets } from "@privy-io/react-auth";
import { PrivyUserPill } from "@/components/privy/PrivyUserPill";
import { TkTag } from "@/components/ds";
import {
  usePrivyFiatOnramp,
  isPrivyFiatOnrampFeatureEnabled,
} from "@/hooks/wallet/usePrivyFiatOnramp";
import { useAccountWalletSession } from "@/hooks/auth/useAccountWalletSession";
import type { AuthUser } from "@/lib/auth";
import { getUserLinkedWallets } from "@/lib/auth/wallets";
import {
  findPrivyWalletByAddress,
  isPrivyEmbeddedWallet,
  usePrivyWalletUnlink,
} from "@/lib/privy";
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

export function SettingsWalletSection({ user }: { user: AuthUser }) {
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

  const { unlink: unlinkPrivyWallet, canUnlink } = usePrivyWalletUnlink();
  const { wallets: privyWallets } = useWallets();
  const { exportWallet } = useExportWallet();
  const linkedWallets = getUserLinkedWallets(user);

  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  async function handleUnlink(walletAddress: string) {
    setUnlinking(walletAddress);
    setWalletError(null);
    try {
      await unlinkPrivyWallet(walletAddress);
    } catch (e) {
      setWalletError(e instanceof Error ? e.message : "Could not unlink wallet");
    } finally {
      setUnlinking(null);
    }
  }

  async function handleExport(walletAddress: string) {
    setExporting(walletAddress);
    setExportError(null);
    try {
      await exportWallet({ address: walletAddress });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Export failed";
      const isDashboardGated =
        msg.toLowerCase().includes("not enabled") ||
        msg.toLowerCase().includes("not allowed") ||
        msg.toLowerCase().includes("disabled");
      setExportError(
        isDashboardGated
          ? 'Export is not enabled. Go to Privy Dashboard → Embedded Wallets → enable "Allow users to export their embedded wallet".'
          : msg,
      );
    } finally {
      setExporting(null);
    }
  }

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
        {hint ? (
          <p className="mt-3 text-xs text-[var(--warn)]" role="status">
            {hint}
          </p>
        ) : null}
      </div>

      <div className="tk-settings__card">
        <div className="tk-settings__lbl" style={{ marginBottom: 4 }}>
          Payment methods
        </div>
        <div className="tk-settings__row">
          <div>
            <div className="tk-settings__row-t">Saved cards</div>
            <div className="tk-settings__row-d">
              Card vault is coming soon. Use Add funds for MoonPay checkout today.
            </div>
          </div>
          <SettingsBtn
            variant="ghost"
            size="sm"
            onClick={() => setHint("Saved payment methods are coming soon.")}
          >
            Coming soon
          </SettingsBtn>
        </div>
      </div>

      <div className="tk-settings__card">
        <div className="tk-settings__lbl" style={{ marginBottom: 4 }}>
          Linked wallets
        </div>
        <p className="mb-1 text-[12.5px] leading-relaxed text-[var(--t2)]">
          Your Privy embedded wallet is the account primary for vault, mint, and trading.
        </p>

        {linkedWallets.length > 0 ? (
          <ul>
            {linkedWallets.map((w) => {
              const privyWallet = findPrivyWalletByAddress(privyWallets, w.address);
              const embedded = isPrivyEmbeddedWallet(privyWallet);
              const showUnlink = canUnlink(w.address);

              return (
                <li key={w.address} className="tk-settings__row tk-settings__row--start">
                  <div className="min-w-0 flex-1">
                    <p className="tk-settings__wallet-addr" title={w.address}>
                      {w.address}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {w.isPrimary ? <TkTag tone="brand">Primary</TkTag> : null}
                      <TkTag tone="neutral">
                        {embedded ? "Embedded (Privy)" : "External"}
                      </TkTag>
                    </div>
                    {embedded ? (
                      <div className="mt-3">
                        <p className="mb-2 text-xs leading-relaxed text-[var(--t2)]">
                          Export your private key to import this wallet into MetaMask.
                        </p>
                        <SettingsBtn
                          variant="ghost"
                          size="sm"
                          disabled={exporting === w.address}
                          onClick={() => void handleExport(w.address)}
                        >
                          {exporting === w.address ? "Opening…" : "Export private key"}
                        </SettingsBtn>
                      </div>
                    ) : null}
                  </div>
                  {showUnlink ? (
                    <SettingsBtn
                      variant="ghost"
                      size="sm"
                      disabled={unlinking === w.address}
                      onClick={() => void handleUnlink(w.address)}
                    >
                      {unlinking === w.address ? "…" : "Unlink"}
                    </SettingsBtn>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="tk-settings__row text-sm text-[var(--t2)]">No wallet linked yet.</p>
        )}

        {walletError ? (
          <p className="mt-3 text-sm text-[var(--neg)]" role="alert">
            {walletError}
          </p>
        ) : null}
        {exportError ? (
          <p className="mt-3 text-sm text-[var(--neg)]" role="alert">
            {exportError}
          </p>
        ) : null}

        <div className="mt-4">
          <PrivyUserPill
            action={{
              type: "connectWallet",
              options: {
                description: "Link MetaMask or another external wallet to your account",
              },
            }}
          />
        </div>
      </div>
    </section>
  );
}
