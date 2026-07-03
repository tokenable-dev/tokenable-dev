"use client";

import { parseFriendlyMintError } from "@/lib/vault/friendlyMintError";
import type { MintFormStep } from "@/lib/vault/mintFormConstants";
import type { PsaInputMode } from "@/lib/vault/mintFormConstants";
import {
  GradientOutlineFrame,
  VAULT_OUTLINE_PAD_CLASS,
} from "@/components/ui/GradientOutlineFrame";
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
        <GradientOutlineFrame className="w-full" padClass={VAULT_OUTLINE_PAD_CLASS}>
          <div className="flex justify-center py-1">
            {isWalletActivating || hasAccountWallet ? (
              <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-mint border-t-transparent" />
                <span>Preparing account wallet…</span>
              </div>
            ) : (
              <WalletConnect />
            )}
          </div>
        </GradientOutlineFrame>
      ) : showMintReady ? (
        <GradientOutlineFrame className="w-full" padClass={VAULT_OUTLINE_PAD_CLASS}>
          <button
            type="submit"
            disabled={isProcessing || showPsaAnalyzeOverlay}
            className="w-full rounded-[11px] border-0 !bg-black py-3.5 text-sm font-bold text-mint transition disabled:cursor-not-allowed disabled:!bg-black disabled:text-mint/35"
            style={{ backgroundColor: "#000000" }}
          >
            {isProcessing
              ? "Minting…"
              : showPsaAnalyzeOverlay
                ? psaInputMode === "cert"
                  ? "Looking up cert…"
                  : "Analyzing slab…"
                : "Mint"}
          </button>
        </GradientOutlineFrame>
      ) : null}

      {isProcessing && (
        <div className="flex items-center gap-2 py-1">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-mint border-t-transparent" />
          <span className="text-sm text-gray-400">
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
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-xs break-all text-red-400">{errorMsg}</p>
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
