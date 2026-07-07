"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DeleteAccountSettingsRow } from "@/components/auth/DeleteAccountSettings";
import { PrivyUserPill } from "@/components/privy/PrivyUserPill";
import { TkButton, TkTag } from "@/components/ds";
import {
  usePrivyWalletUnlink,
  findPrivyWalletByAddress,
  isPrivyEmbeddedWallet,
} from "@/lib/privy";
import { getUserLinkedWallets } from "@/lib/auth/wallets";
import { useAuthStore } from "@/store/authStore";
import { useExportWallet, useWallets } from "@privy-io/react-auth";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, initialized } = useAuthStore();
  const { unlink: unlinkPrivyWallet, canUnlink } = usePrivyWalletUnlink();
  const { wallets: privyWallets } = useWallets();
  const { exportWallet } = useExportWallet();
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const linkedWallets = getUserLinkedWallets(user);

  useEffect(() => {
    if (!loading && initialized && !user) {
      router.replace("/login");
    }
  }, [user, loading, initialized, router]);

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

  if (!user) {
    return (
      <div className="secondary-page secondary-page--centered">
        <div className="secondary-spinner" aria-label="Loading profile" />
      </div>
    );
  }

  const displayName =
    user.name?.trim() ||
    (user.walletAddress
      ? `${user.walletAddress.slice(0, 6)}…${user.walletAddress.slice(-4)}`
      : user.email.split("@")[0]);

  return (
    <div className="secondary-page">
      <main className="secondary-page__shell secondary-page__shell--narrow">
        <header className="secondary-profile-header">
          <div className="flex min-w-0 items-center gap-3">
            {user.pictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.pictureUrl}
                alt=""
                className="secondary-profile-header__avatar"
              />
            ) : (
              <span className="secondary-profile-header__avatar secondary-profile-header__avatar-fallback">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="secondary-profile-header__name">{displayName}</h1>
              <p className="secondary-profile-header__email">{user.email}</p>
            </div>
          </div>
        </header>

        <section className="secondary-panel">
          <h2 className="secondary-panel__title">Wallet identity</h2>
          <p className="secondary-panel__text">
            Your Privy embedded wallet is the account primary for vault, mint, and trading.
            Link MetaMask or another external wallet below — it stays secondary; unlink anytime.
          </p>

          {linkedWallets.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {linkedWallets.map((w) => {
                const privyWallet = findPrivyWalletByAddress(privyWallets, w.address);
                const embedded = isPrivyEmbeddedWallet(privyWallet);
                const showUnlink = canUnlink(w.address);

                return (
                  <li key={w.address} className="secondary-wallet-row">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="secondary-wallet-row__address" title={w.address}>
                          {w.address}
                        </p>
                        <div className="secondary-wallet-row__meta mt-2">
                          {w.isPrimary ? <TkTag tone="brand">Primary</TkTag> : null}
                          <TkTag tone="neutral">
                            {embedded ? "Embedded (Privy)" : "External (MetaMask / EOA)"}
                          </TkTag>
                        </div>
                      </div>
                      {showUnlink ? (
                        <TkButton
                          type="button"
                          variant="subtle"
                          size="sm"
                          disabled={unlinking === w.address}
                          onClick={() => void handleUnlink(w.address)}
                        >
                          {unlinking === w.address ? "…" : "Unlink"}
                        </TkButton>
                      ) : null}
                    </div>

                    {embedded ? (
                      <div className="border-t border-white/[0.06] pt-3">
                        <p className="mb-2 text-[11px] leading-relaxed text-[var(--t2)]">
                          Export your private key to import this wallet into MetaMask or any
                          external wallet app.
                        </p>
                        <TkButton
                          type="button"
                          variant="neutral"
                          size="sm"
                          disabled={exporting === w.address}
                          onClick={() => void handleExport(w.address)}
                        >
                          {exporting === w.address ? "Opening…" : "Export private key"}
                        </TkButton>
                        {exportError && exporting !== w.address ? (
                          <p className="mt-2 text-[11px] text-[var(--neg)]">{exportError}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[var(--t2)]">No wallet linked yet.</p>
          )}

          {walletError ? (
            <p className="mt-3 text-sm text-[var(--neg)]" role="alert">
              {walletError}
            </p>
          ) : null}

          <div className="mt-4 flex justify-start">
            <PrivyUserPill
              action={{
                type: "connectWallet",
                options: {
                  description: "Link MetaMask or another external wallet to your account",
                },
              }}
            />
          </div>
        </section>

        <DeleteAccountSettingsRow />
      </main>
    </div>
  );
}
