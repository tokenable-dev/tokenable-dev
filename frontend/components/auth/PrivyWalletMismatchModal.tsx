"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { PrivyUserPill } from "@/components/privy/PrivyUserPill";
import { AuthModalShell } from "./AuthModalShell";
import { refreshPrivyAuthSession } from "@/lib/privy";
import {
  getPrimaryWalletAddress,
  getUserLinkedWallets,
  normalizeWalletAddress,
} from "@/lib/auth/wallets";
import { useLinkedPortfolioWallet } from "@/hooks/auth/useLinkedPortfolioWallet";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

export function PrivyWalletMismatchModal() {
  const router = useRouter();
  const open = useAuthUiStore((s) => s.walletMismatchOpen);
  const closeWalletMismatch = useAuthUiStore((s) => s.closeWalletMismatch);
  const consumeReturnTo = useAuthUiStore((s) => s.consumeReturnTo);
  const user = useAuthStore((s) => s.user);
  const setAuthUser = useAuthStore((s) => s.setUser);
  const { getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const wallet = useLinkedPortfolioWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const walletsBeforeLink = useRef<string>("");

  const connected = wallet.connectedAddress;
  const primaryLinked = getPrimaryWalletAddress(user);
  const linkedWallets = getUserLinkedWallets(user);

  const finish = useCallback(() => {
    const returnTo = consumeReturnTo();
    closeWalletMismatch();
    setError(null);
    if (returnTo) router.push(returnTo);
  }, [closeWalletMismatch, consumeReturnTo, router]);

  const dismiss = useCallback(() => {
    closeWalletMismatch();
    setError(null);
  }, [closeWalletMismatch]);

  const syncSession = useCallback(async () => {
    const updated = await refreshPrivyAuthSession(getAccessToken);
    if (updated) setAuthUser(updated);
    return updated;
  }, [getAccessToken, setAuthUser]);

  const handleUsePrimary = useCallback(async () => {
    if (!primaryLinked) return;
    setBusy(true);
    setError(null);
    try {
      const match = wallets.find(
        (w) =>
          normalizeWalletAddress(w.address)?.toLowerCase() ===
          primaryLinked.toLowerCase(),
      );
      if (!match) {
        setError("Linked wallet is not available in this browser session.");
        return;
      }
      await setActiveWallet(match);
      await syncSession();
      finish();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not switch wallet");
    } finally {
      setBusy(false);
    }
  }, [primaryLinked, wallets, setActiveWallet, syncSession, finish]);

  const walletFingerprint = wallets
    .map((w) => w.address.toLowerCase())
    .sort()
    .join(",");

  useEffect(() => {
    if (!open) {
      walletsBeforeLink.current = walletFingerprint;
      return;
    }

    if (primaryLinked) {
      void handleUsePrimary();
      return;
    }

    if (
      walletsBeforeLink.current &&
      walletFingerprint !== walletsBeforeLink.current
    ) {
      walletsBeforeLink.current = walletFingerprint;
      void (async () => {
        setBusy(true);
        setError(null);
        try {
          if (connected) {
            const match = wallets.find(
              (w) =>
                normalizeWalletAddress(w.address)?.toLowerCase() ===
                connected.toLowerCase(),
            );
            if (match) await setActiveWallet(match);
          }
          await syncSession();
          finish();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not link wallet");
        } finally {
          setBusy(false);
        }
      })();
      return;
    }
    walletsBeforeLink.current = walletFingerprint;
  }, [
    open,
    walletFingerprint,
    connected,
    wallets,
    setActiveWallet,
    syncSession,
    finish,
    handleUsePrimary,
    primaryLinked,
  ]);

  const titleId = "privy-wallet-mismatch-modal-title";

  return (
    <AuthModalShell open={open} onClose={dismiss} titleId={titleId} maxWidthClass="max-w-md">
      <div className="px-5 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-4 sm:px-7 sm:pb-7 sm:pt-6">
        <h2 id={titleId} className="text-base font-bold text-white sm:text-xl">
          Wallet mismatch
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          The wallet in your browser does not match your Tokenable account.
        </p>

        {connected ? (
          <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900/50 px-3 py-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">
              Connected now
            </p>
            <p className="mt-1 break-all font-mono text-xs text-white">{connected}</p>
          </div>
        ) : null}

        {linkedWallets.length > 0 && primaryLinked ? (
          <div className="mt-3 rounded-xl border border-mint/20 bg-mint/5 px-3 py-3">
            <p className="text-[10px] uppercase tracking-wide text-mint/80">
              Account wallet
            </p>
            <p className="mt-1 break-all font-mono text-xs text-mint">{primaryLinked}</p>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 text-center text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 space-y-3 sm:mt-6">
          {primaryLinked ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleUsePrimary()}
              className="flex w-full min-h-[48px] items-center justify-center rounded-xl border border-gray-700 bg-gray-800/50 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50 sm:min-h-[52px] sm:text-base"
            >
              {busy ? "…" : "Use account wallet"}
            </button>
          ) : null}
          <div className="flex justify-center">
            <PrivyUserPill
              action={{
                type: "connectWallet",
                options: {
                  description: "Link the wallet in your browser to this account",
                },
              }}
            />
          </div>
        </div>
      </div>
    </AuthModalShell>
  );
}
