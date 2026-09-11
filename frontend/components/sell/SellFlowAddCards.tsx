"use client";

import { TkButton } from "@/components/ds";
import type { useSellFlow } from "@/hooks/sell/useSellFlow";
import {
  SLAB_UPLOAD_ACCEPT,
  SLAB_UPLOAD_FORMAT_HINT,
} from "@/lib/vault/mintImageSource";
import { SellFlowCertDirectInput } from "./SellFlowCertDirectInput";
import { SellFlowCertProgress } from "./SellFlowCertProgress";
import { SellFlowYourCardsSection } from "./SellFlowYourCardsSection";

type Flow = ReturnType<typeof useSellFlow>;

function BackChevron() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

/** Sell-Flow.html add-cards step — PSA vault shipping path. */
export function SellFlowAddCards({ flow }: { flow: Flow }) {
  const {
    cards,
    maxCards,
    showCertDirectInput,
    certInput,
    setCertInput,
    certError,
    lookupBusy,
    draftSavedFlash,
    mintBusy,
    slabInputRef,
    canContinueShipping,
    lookupCert,
    scanSlab,
    onSlabFile,
    toggleConfirm,
    setAllConfirmed,
    removeCard,
    saveDraft,
    continueToShipping,
    goToVault,
    vaultChoice,
  } = flow;

  const allConfirmed = cards.length > 0 && cards.every((c) => c.confirmed);
  const busy = lookupBusy || mintBusy;

  return (
    <section className="sell-flow-screen">
      <div className="sell-flow-col sell-flow-col--narrow">
        <button
          type="button"
          className="sell-flow-btn-back"
          onClick={goToVault}
          disabled={mintBusy}
        >
          <BackChevron />
          Back
        </button>

        <div className="sell-flow-eyebrow">
          {vaultChoice === "self" ? "Tokenable Vault" : "PSA Vault"}
        </div>
        <h1 className="sell-flow-h1">Add your cards</h1>
        <p className="sell-flow-sub">
          {showCertDirectInput
            ? "Upload a photo of the slab or type the cert number. We’ll pull the card details from PSA."
            : "Upload a photo of the slab. We’ll pull the card details from PSA."}
        </p>

        <div className="sell-flow-glass sell-flow-glass--cards-input">
          <TkButton
            type="button"
            variant="subtle"
            className="sell-flow-scan-btn"
            disabled={busy}
            onClick={scanSlab}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
              <line x1="7" y1="12" x2="17" y2="12" />
            </svg>
            Upload Slab
          </TkButton>
          <input
            ref={slabInputRef}
            type="file"
            accept={SLAB_UPLOAD_ACCEPT}
            capture="environment"
            className="sr-only"
            aria-hidden
            tabIndex={-1}
            onChange={(e) => void onSlabFile(e.target.files?.[0] ?? null)}
          />
          <p className="sell-flow-upload-hint tkl-mono">{SLAB_UPLOAD_FORMAT_HINT}</p>

          {showCertDirectInput ? (
            <SellFlowCertDirectInput
              value={certInput}
              onChange={setCertInput}
              onLookup={() => void lookupCert()}
              busy={busy}
              error={certError}
            />
          ) : null}

          <SellFlowCertProgress active={lookupBusy} tone="light" />
          {certError ? (
            <p className="sell-flow-cert-error" id="cert-error" role="alert">
              {certError}
            </p>
          ) : null}
        </div>

        <SellFlowYourCardsSection
          variant="psa"
          cards={cards}
          maxCards={maxCards}
          allConfirmed={allConfirmed}
          onToggleConfirm={toggleConfirm}
          onToggleAllConfirmed={setAllConfirmed}
          onRemove={removeCard}
          allowCertDirectInput={showCertDirectInput}
        />

        <div className="sell-flow-cards-cta">
          <TkButton
            type="button"
            variant="subtle"
            className="sell-flow-draft-btn"
            disabled={mintBusy || cards.length === 0}
            onClick={() => saveDraft()}
          >
            {draftSavedFlash ? "Saved" : "Save as draft"}
          </TkButton>
          <TkButton
            type="button"
            variant="primary"
            className="sell-flow-ship-btn"
            disabled={!canContinueShipping || mintBusy}
            onClick={() => continueToShipping()}
          >
            Continue to shipping <span className="tkl-mono" aria-hidden>→</span>
          </TkButton>
        </div>
      </div>
    </section>
  );
}
