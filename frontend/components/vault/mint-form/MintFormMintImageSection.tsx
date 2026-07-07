"use client";

import type { PsaAnalyzeResult } from "@/lib/core";
import { SHOW_VAULT_COLLAPSIBLE_SECTIONS } from "@/lib/vault/mintFormConstants";
import { psaCertImageMatchesFormCert } from "@/lib/vault/mintFormPsa";
import type { PsaInputMode } from "@/lib/vault/mintFormConstants";
import type { GradedCardFormState } from "@/types/gradedCard";

export function MintFormMintImageSection({
  showCollapsible,
  showPsaAnalyzeOverlay,
  lastAnalyze,
  form,
  mintImageBlobUrl,
  psaInputMode,
  imageError,
}: {
  showCollapsible: boolean;
  showPsaAnalyzeOverlay: boolean;
  lastAnalyze: PsaAnalyzeResult | null;
  form: GradedCardFormState;
  mintImageBlobUrl: string | null;
  psaInputMode: PsaInputMode;
  imageError?: string;
}) {
  const body = showPsaAnalyzeOverlay ? (
    <div className="rounded-lg border border-dashed border-gray-700/80 bg-gray-900/20 px-4 py-8 text-center">
      <p className="text-sm text-gray-500">
        The mint image will appear here when analysis finishes.
      </p>
    </div>
  ) : (
    <>
      {lastAnalyze?.cardhedgerMint?.imageUrl && !lastAnalyze?.psaCertImages?.front && (
        <div className="space-y-4 rounded-lg border border-gray-700/80 bg-gray-900/40 p-4 sm:p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
            <div className="mx-auto flex shrink-0 flex-col items-center lg:mx-0">
              <div className="rounded-xl border border-gray-700 bg-[#070a0f] p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lastAnalyze.cardhedgerMint.imageUrl}
                  alt="Cardhedger card image — RWA display image"
                  className="max-h-[min(52vh,280px)] w-auto max-w-[min(100%,280px)] object-contain rounded-lg"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center pt-0 lg:pt-2">
              <p className="text-xs text-gray-500">
                Cardhedger image is used because PSA cert image is unavailable.
              </p>
            </div>
          </div>
        </div>
      )}

      {lastAnalyze?.psaCertImages?.front && (
        <div className="space-y-4 rounded-lg border border-gray-700/80 bg-gray-900/40 p-4 sm:p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
            <div className="mx-auto flex shrink-0 flex-col items-center lg:mx-0">
              <div className="rounded-xl border border-gray-700 bg-[#070a0f] p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lastAnalyze.psaCertImages.front}
                  alt="PSA cert slab — RWA display image"
                  className="max-h-[min(52vh,280px)] w-auto max-w-[min(100%,280px)] object-contain rounded-lg"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center pt-0 lg:pt-2">
              {psaCertImageMatchesFormCert(lastAnalyze, form.grade.certNumber) ? (
                <>
                  <p className="text-xs text-gray-500">
                    PSA image is used for IPFS and marketplace art.
                  </p>
                  <span className="mt-2 inline-flex w-fit rounded-full border border-mint-deep/50 bg-mint/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-mint">
                    Source: PSA Cert Image
                  </span>
                </>
              ) : (
                <div className="rounded-lg border border-amber-400/35 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-100/90">
                  PSA returned a slab photo for cert{" "}
                  <span className="font-mono">{lastAnalyze.psa.certNumber ?? "—"}</span>, which does
                  not match the cert you entered (
                  <span className="font-mono">{form.grade.certNumber || "—"}</span>). This PSA image
                  will <strong>not</strong> be used for minting — use Cert # lookup or upload the
                  correct slab.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!lastAnalyze?.psaCertImages?.front &&
        !lastAnalyze?.cardhedgerMint?.imageUrl &&
        form.image instanceof File &&
        mintImageBlobUrl && (
          <div className="space-y-2 rounded-lg border border-gray-700/80 bg-gray-900/35 p-4 sm:p-5">
            <p className="text-xs font-medium text-gray-300">Slab photo to mint image</p>
            <div className="inline-block rounded-lg border border-gray-700/80 bg-[#0a0e14] p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mintImageBlobUrl}
                alt="Slab photo for mint"
                className="max-h-52 max-w-[min(100%,280px)] object-contain rounded-lg"
              />
            </div>
          </div>
        )}

      {!lastAnalyze?.psaCertImages?.front &&
        !lastAnalyze?.cardhedgerMint?.imageUrl &&
        !(form.image instanceof File) &&
        !showPsaAnalyzeOverlay && (
          <div className="rounded-lg border border-dashed border-gray-700/60 bg-gray-900/20 px-4 py-5 text-center">
            <p className="text-xs text-gray-500">
              {psaInputMode === "cert"
                ? "Run cert lookup — PSA slab image when available, otherwise Cardhedger catalog art."
                : "Appears here after slab analysis."}
            </p>
          </div>
        )}
    </>
  );

  if (!showCollapsible) {
    return imageError ? <p className="text-xs text-red-400">{imageError}</p> : null;
  }

  return (
    <details className="group rounded-xl border border-gray-700/50 bg-gray-800/20 overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800/35 [&::-webkit-details-marker]:hidden">
        <span>Mint image</span>
        <svg
          className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="space-y-5 border-t border-gray-700/40 px-4 pb-4 pt-3 sm:px-5">
        {body}
        {imageError ? <p className="text-xs text-red-400">{imageError}</p> : null}
      </div>
    </details>
  );
}
