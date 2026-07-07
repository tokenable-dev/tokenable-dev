"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { PrivyUserPill } from "@/components/privy/PrivyUserPill";
import { TkButton, TkDialog } from "@/components/ds";
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

  return (
    <TkDialog
      open={open}
      onClose={dismiss}
      title="Wallet mismatch"
      description="The wallet in your browser does not match your Tokenable account."
      footer={
        <div className="flex w-full flex-col gap-3">
          {primaryLinked ? (
            <TkButton
              variant="primary"
              disabled={busy}
              onClick={() => void handleUsePrimary()}
              className="w-full justify-center"
            >
              {busy ? "…" : "Use account wallet"}
            </TkButton>
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
      }
    >
      {connected ? (
        <div className="secondary-dialog-wallet">
          <p className="secondary-dialog-wallet__label">Connected now</p>
          <p className="secondary-dialog-wallet__value">{connected}</p>
        </div>
      ) : null}

      {linkedWallets.length > 0 && primaryLinked ? (
        <div className="secondary-dialog-wallet secondary-dialog-wallet--brand">
          <p className="secondary-dialog-wallet__label">Account wallet</p>
          <p className="secondary-dialog-wallet__value">{primaryLinked}</p>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-center text-sm text-[var(--neg)]" role="alert">
          {error}
        </p>
      ) : null}
    </TkDialog>
  );
}
