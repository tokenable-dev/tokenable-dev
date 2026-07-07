"use client";

import { TkButton } from "@/components/ds";
import { parseFriendlyMintError } from "@/lib/vault/friendlyMintError";
import type { MintFormStep } from "@/lib/vault/mintFormConstants";
import type { PsaInputMode } from "@/lib/vault/mintFormConstants";
import { WalletConnect } from "@/components/wallet/WalletConnect";

type MintFormMintActionsProps = {
  isWalletReady: boolean;
  isWalletActivating: boolean;
  hasAccountWallet: boolean;
  showMintReady: boolean;
  isProcessing: boolean;
  showPsaAnalyzeOverlay: boolean;
  psaInputMode: PsaInputMode;
  step: MintFormStep;
  errorMsg: string;
};

export function MintFormMintActions({
  isWalletReady,
  isWalletActivating,
  hasAccountWallet,
  showMintReady,
  isProcessing,
  showPsaAnalyzeOverlay,
  psaInputMode,
  step,
  errorMsg,
}: MintFormMintActionsProps) {
  return (
    <>
      {!isWalletReady ? (
        <div className="flex justify-center py-2">
          {isWalletActivating || hasAccountWallet ? (
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-[var(--t2)]">
              <div
                className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--azure)] border-t-transparent"
                aria-hidden
              />
              <span>Preparing account wallet…</span>
            </div>
          ) : (
            <WalletConnect />
          )}
        </div>
      ) : showMintReady ? (
        <TkButton
          type="submit"
          variant="primary"
          className="w-full"
          disabled={isProcessing || showPsaAnalyzeOverlay}
        >
          {isProcessing
            ? "Minting…"
            : showPsaAnalyzeOverlay
              ? psaInputMode === "cert"
                ? "Looking up cert…"
                : "Analyzing slab…"
              : "Mint"}
        </TkButton>
      ) : null}

      {isProcessing && (
        <div className="flex items-center gap-2 py-1">
          <div
            className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--azure)] border-t-transparent"
            aria-hidden
          />
          <span className="text-sm text-[var(--t2)]">
            {step === "uploading"
              ? "Uploading to IPFS..."
              : "Submitting mint — platform is minting to custody; admin will deliver to your account wallet."}
          </span>
        </div>
      )}

      {step === "error" && errorMsg ? (
        (() => {
          const friendly = parseFriendlyMintError(errorMsg);
          if (!friendly) {
            return (
              <div className="rounded-lg border border-[var(--neg)]/30 bg-[var(--neg)]/10 p-3">
                <p className="text-xs break-all text-[var(--neg)]">{errorMsg}</p>
              </div>
            );
          }
          return (
            <div className="rounded-xl border border-amber-400/35 bg-amber-500/[0.10] p-3.5 sm:p-4">
              <p className="text-sm font-semibold text-amber-200">{friendly.title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-amber-100/90">
                {friendly.message}
              </p>
              <ul className="mt-2.5 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-amber-100/80">
                {friendly.hints.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          );
        })()
      ) : null}
    </>
  );
}
