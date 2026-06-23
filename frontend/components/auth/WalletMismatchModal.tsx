"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { AuthModalShell } from "./AuthModalShell";
import { AUTH_PRIMARY_BTN } from "./authUiStyles";
import { useLinkedPortfolioWallet } from "@/hooks/auth/useLinkedPortfolioWallet";
import { useWalletLink } from "@/hooks/auth/useWalletLink";
import { useAuthUiStore } from "@/store/authUiStore";

export function WalletMismatchModal() {
  const router = useRouter();
  const open = useAuthUiStore((s) => s.walletMismatchOpen);
  const closeWalletMismatch = useAuthUiStore((s) => s.closeWalletMismatch);
  const consumeReturnTo = useAuthUiStore((s) => s.consumeReturnTo);
  const wallet = useLinkedPortfolioWallet();
  const { linkAddress, linking, error, clearError } = useWalletLink();

  const connected = wallet.connectedAddress;

  const finish = useCallback(() => {
    const returnTo = consumeReturnTo();
    closeWalletMismatch();
    clearError();
    if (returnTo) router.push(returnTo);
  }, [closeWalletMismatch, clearError, consumeReturnTo, router]);

  const dismiss = useCallback(() => {
    closeWalletMismatch();
    clearError();
  }, [closeWalletMismatch, clearError]);

  const handleLink = useCallback(async () => {
    if (!connected) return;
    clearError();
    const ok = await linkAddress(connected);
    if (ok) finish();
  }, [connected, linkAddress, clearError, finish]);

  const titleId = "wallet-mismatch-modal-title";

  return (
    <AuthModalShell open={open} onClose={dismiss} titleId={titleId} maxWidthClass="max-w-md">
      <div className="px-5 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-4 sm:px-7 sm:pb-7 sm:pt-6">
        <div
          className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-700 sm:hidden"
          aria-hidden
        />

        <h2 id={titleId} className="text-base font-bold text-white sm:text-xl">
          Link wallet
        </h2>
        <p className="mt-1.5 text-sm text-gray-400">Add this wallet to your account.</p>

        {connected ? (
          <div className="mt-4 max-h-28 overflow-y-auto rounded-xl border border-gray-800 bg-gray-900/50 px-3 py-3 sm:max-h-none">
            <p
              className="select-all break-all font-mono text-[11px] leading-relaxed text-white sm:text-sm"
              title={connected}
            >
              {connected}
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 text-center text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2 sm:mt-6">
          <button
            type="button"
            disabled={linking}
            onClick={() => void handleLink()}
            className={`${AUTH_PRIMARY_BTN} min-h-[48px] text-sm sm:min-h-[52px] sm:text-base`}
          >
            {linking ? "…" : "Add wallet"}
          </button>
          <button
            type="button"
            disabled={linking}
            onClick={dismiss}
            className="min-h-[44px] w-full text-sm text-gray-500 hover:text-gray-300 disabled:opacity-50"
          >
            Not now
          </button>
        </div>
      </div>
    </AuthModalShell>
  );
}
