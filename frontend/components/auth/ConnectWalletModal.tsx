"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useConnect } from "wagmi";
import { AuthModalShell } from "./AuthModalShell";
import { AUTH_MINT_LINK } from "./authUiStyles";
import { useAuthUiStore } from "@/store/authUiStore";
import { useWalletLink } from "@/hooks/auth/useWalletLink";
import {
  connectMetaMaskWallet,
  findMetaMaskConnector,
} from "@/lib/wallet/connectMetaMaskWallet";
import {
  isWalletSessionActive,
  isWalletSessionPending,
} from "@/lib/wallet/walletConnectionDisplay";

export function ConnectWalletModal() {
  const router = useRouter();
  const connectWalletOpen = useAuthUiStore((s) => s.connectWalletOpen);
  const closeConnectWallet = useAuthUiStore((s) => s.closeConnectWallet);
  const consumeReturnTo = useAuthUiStore((s) => s.consumeReturnTo);

  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { linking, error, isLinkedTo, linkAddress, clearError } = useWalletLink();
  /** One auto-link attempt per address per modal open — no retry loop after cancel. */
  const autoLinkAttemptedFor = useRef<string | null>(null);

  const sessionActive = isWalletSessionActive({
    address,
    isConnected,
    isConnecting,
    isReconnecting,
  });
  const sessionPending = isWalletSessionPending({
    address,
    isConnected,
    isConnecting,
    isReconnecting,
  });

  const finish = useCallback(() => {
    const returnTo = consumeReturnTo();
    closeConnectWallet();
    if (returnTo) router.push(returnTo);
  }, [closeConnectWallet, consumeReturnTo, router]);

  const runLink = useCallback(
    async (target: string, opts?: { manual?: boolean }) => {
      if (opts?.manual) {
        autoLinkAttemptedFor.current = null;
      }
      const key = target.toLowerCase();
      if (!opts?.manual && autoLinkAttemptedFor.current === key) return;
      autoLinkAttemptedFor.current = key;

      const ok = await linkAddress(target);
      if (ok) finish();
    },
    [linkAddress, finish],
  );

  useEffect(() => {
    if (!connectWalletOpen) {
      autoLinkAttemptedFor.current = null;
      clearError();
    }
  }, [connectWalletOpen, clearError]);

  useEffect(() => {
    if (!connectWalletOpen || !sessionActive || !address || linking) return;

    if (isLinkedTo(address)) {
      finish();
      return;
    }

    void runLink(address);
  }, [
    connectWalletOpen,
    sessionActive,
    address,
    linking,
    isLinkedTo,
    runLink,
    finish,
  ]);

  const busy = sessionPending || isPending || linking;
  const metaMaskReady = Boolean(findMetaMaskConnector(connectors));
  const titleId = "connect-wallet-modal-title";
  const needsManualSign =
    Boolean(sessionActive && address && !isLinkedTo(address) && error);

  return (
    <AuthModalShell
      open={connectWalletOpen}
      onClose={closeConnectWallet}
      titleId={titleId}
      maxWidthClass="max-w-sm"
    >
      <div className="px-6 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-6 sm:px-7 sm:pb-7">
        <h2 id={titleId} className="text-lg font-bold text-white sm:text-xl">
          Connect wallet
        </h2>

        <div className="mt-5">
          <button
            type="button"
            disabled={busy || !metaMaskReady}
            onClick={() => {
              clearError();
              connectMetaMaskWallet(connect, connectors);
            }}
            className="flex w-full items-center gap-3 rounded-xl border border-gray-700/80 bg-gray-800/40 px-4 py-3.5 transition-colors hover:border-gray-600 hover:bg-gray-800/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-700/60 bg-gray-900/80 text-lg"
              aria-hidden
            >
              🦊
            </span>
            <span className="text-sm font-semibold text-white">MetaMask</span>
            {busy ? (
              <span className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-mint/30 border-t-mint" />
            ) : null}
          </button>
        </div>

        {error ? <p className="mt-4 text-center text-sm text-red-400">{error}</p> : null}

        {needsManualSign && address ? (
          <button
            type="button"
            disabled={linking}
            onClick={() => void runLink(address, { manual: true })}
            className={`${AUTH_MINT_LINK} mt-3 block w-full text-center disabled:opacity-50`}
          >
            {linking ? "Waiting for signature…" : "Sign to link wallet"}
          </button>
        ) : null}
      </div>
    </AuthModalShell>
  );
}
