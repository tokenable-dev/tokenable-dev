"use client";

import { createPortal } from "react-dom";
import { PSA_RATE_LIMIT_ALERT_MESSAGE } from "@/lib/psa/psaApiErrors";
import type { PsaInputMode } from "@/lib/vault/mintFormConstants";

export function MintPsaAnalyzeOverlay({
  open,
  psaRateLimitAlert,
  psaInputMode,
  onDismissRateLimit,
}: {
  open: boolean;
  psaRateLimitAlert: boolean;
  psaInputMode: PsaInputMode;
  onDismissRateLimit: () => void;
}) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px] pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-busy={!psaRateLimitAlert}
      aria-label={
        psaRateLimitAlert
          ? PSA_RATE_LIMIT_ALERT_MESSAGE
          : psaInputMode === "cert"
            ? "Looking up PSA cert"
            : "Analyzing slab"
      }
    >
      <div
        className={`rounded-xl border bg-gray-950/96 shadow-2xl shadow-black/55 ${
          psaRateLimitAlert
            ? "max-w-sm border-zinc-700/60 px-5 py-5 sm:px-6"
            : "border-gray-700/80 p-6 sm:p-7"
        }`}
      >
        <div className="flex flex-col items-center">
          {psaRateLimitAlert ? (
            <>
              <p
                className="max-w-[26ch] text-center text-xs leading-relaxed text-zinc-400"
                role="alert"
              >
                {PSA_RATE_LIMIT_ALERT_MESSAGE}
              </p>
              <button
                type="button"
                onClick={onDismissRateLimit}
                className="mt-4 flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-900/60 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
                aria-label="Close"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </>
          ) : (
            <div className="relative h-12 w-12 shrink-0" role="status" aria-live="polite">
              <div
                className="absolute inset-0 rounded-full border-2 border-gray-700"
                aria-hidden
              />
              <div
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-gray-200 border-r-gray-500 animate-spin"
                style={{ animationDuration: "0.9s" }}
                aria-hidden
              />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
