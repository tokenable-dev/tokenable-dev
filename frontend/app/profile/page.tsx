"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DeleteAccountSettingsRow } from "@/components/auth/DeleteAccountSettings";
import { PrivyUserPill } from "@/components/privy/PrivyUserPill";
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
      // Privy throws when the feature isn't enabled in the Dashboard.
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
      <div className="min-h-[calc(100vh-4rem)] bg-gray-950 flex items-center justify-center">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-mint/30 border-t-mint" />
      </div>
    );
  }

  const displayName =
    user.name?.trim() ||
    (user.walletAddress
      ? `${user.walletAddress.slice(0, 6)}…${user.walletAddress.slice(-4)}`
      : user.email.split("@")[0]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-950 text-white">
      <main className="mx-auto max-w-lg px-4 py-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {user.pictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.pictureUrl}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full border border-gray-700 object-cover"
              />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-sm font-semibold text-mint">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold">{displayName}</h1>
              <p className="truncate text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
        </div>

        <section className="mb-4 rounded-xl border border-gray-800 bg-gray-900/30 p-5">
          <h2 className="text-sm font-semibold text-white">Wallet identity</h2>
          <p className="mt-1 text-xs text-gray-500">
            Your Privy embedded wallet is the account primary for vault, mint, and trading.
            Link MetaMask or another external wallet below — it stays secondary; unlink anytime.
          </p>

          {linkedWallets.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {linkedWallets.map((w) => {
                const privyWallet = findPrivyWalletByAddress(privyWallets, w.address);
                const embedded = isPrivyEmbeddedWallet(privyWallet);
                const showUnlink = canUnlink(w.address);

                return (
                  <li
                    key={w.address}
                    className="flex flex-col gap-2 rounded-lg border border-gray-800/80 bg-black/20 px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p
                          className="select-all break-all font-mono text-[11px] leading-relaxed text-white sm:text-xs"
                          title={w.address}
                        >
                          {w.address}
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-gray-500">
                          {w.isPrimary ? "Primary" : null}
                          {w.isPrimary && embedded ? " · " : null}
                          {embedded ? "Embedded (Privy)" : "External (MetaMask / EOA)"}
                        </p>
                      </div>
                      {showUnlink ? (
                        <button
                          type="button"
                          disabled={unlinking === w.address}
                          onClick={() => void handleUnlink(w.address)}
                          className="shrink-0 text-xs text-gray-500 hover:text-red-400 disabled:opacity-50"
                        >
                          {unlinking === w.address ? "…" : "Unlink"}
                        </button>
                      ) : null}
                    </div>

                    {/* Export private key — only for embedded wallets */}
                    {embedded ? (
                      <div className="border-t border-gray-800/60 pt-2">
                        <p className="mb-1.5 text-[11px] text-gray-500">
                          Export your private key to import this wallet into MetaMask or any external wallet app.
                        </p>
                        <button
                          type="button"
                          disabled={exporting === w.address}
                          onClick={() => void handleExport(w.address)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700/60 bg-gray-800/40 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-gray-600 hover:text-white disabled:opacity-50"
                        >
                          {exporting === w.address ? (
                            <>
                              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8" />
                              </svg>
                              Opening…
                            </>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                              </svg>
                              Export Private Key
                            </>
                          )}
                        </button>
                        {exportError && exporting !== w.address ? (
                          <p className="mt-2 text-[11px] text-red-400">{exportError}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-gray-500">No wallet linked yet.</p>
          )}

          {walletError ? (
            <p className="mt-3 text-sm text-red-400" role="alert">
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
