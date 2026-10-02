"use client";

import { TkButton } from "@/components/ds";
import type { useSellFlow } from "@/hooks/sell/useSellFlow";
import {
  SLAB_UPLOAD_ACCEPT,
  SLAB_UPLOAD_FORMAT_HINT,
} from "@/lib/vault/mintImageSource";
import { SellFlowCertDirectInput } from "./SellFlowCertDirectInput";
import { SellFlowCertProgress } from "./SellFlowCertProgress";
import { SellFlowPartnerDoneModal } from "./SellFlowPartnerDoneModal";
import { SellFlowYourCardsSection } from "./SellFlowYourCardsSection";

type Flow = ReturnType<typeof useSellFlow>;

function BackChevron() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

/** Partner-Add-Cards.html — partner vault bulk upload + mint. */
export function SellFlowPartnerAddCards({ flow }: { flow: Flow }) {
  const {
    cards,
    maxCards,
    showCertDirectInput,
    certInput,
    setCertInput,
    certError,
    lookupBusy,
    mintBusy,
    mintError,
    mintStatus,
    slabInputRef,
    canContinueShipping,
    partnerMintSuccess,
    lookupCert,
    scanSlab,
    onSlabFile,
    toggleConfirm,
    setAllConfirmed,
    removeCard,
    continueToSelfMint,
    goBackToVaultChoice,
    saveDraft,
    draftSavedFlash,
    resetPartnerAddCards,
  } = flow;

  const busy = lookupBusy || mintBusy;
  const allConfirmed = cards.length > 0 && cards.every((c) => c.confirmed);

  return (
    <>
      <section className="sell-flow-screen sell-flow-screen--partner">
        <div className="sell-flow-col sell-flow-col--partner">
          <button
            type="button"
            className="sell-flow-btn-back"
            onClick={goBackToVaultChoice}
            disabled={mintBusy}
          >
            <BackChevron />
            Back
          </button>

          <div className="sell-flow-eyebrow">Tokenable Vault</div>
          <h1 className="sell-flow-h1">Add your cards</h1>

          <div className="sell-flow-glass sell-flow-glass--partner-input">
            <TkButton
              type="button"
              variant="subtle"
              className="sell-flow-scan-btn"
              disabled={busy}
              onClick={scanSlab}
            >
              <ScanIcon />
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
                partner
              />
            ) : null}

            <SellFlowCertProgress active={lookupBusy} tone="light" />
            {certError ? (
              <p className="sell-flow-partner-cert-error" id="cert-error" role="alert">
                {certError}
              </p>
            ) : null}
          </div>

          <SellFlowYourCardsSection
            variant="partner"
            cards={cards}
            maxCards={maxCards}
            allConfirmed={allConfirmed}
            onToggleConfirm={toggleConfirm}
            onToggleAllConfirmed={setAllConfirmed}
            onRemove={removeCard}
            allowCertDirectInput={showCertDirectInput}
          />

          {mintStatus ? (
            <p className="sell-flow-mint-status" role="status">
              {mintStatus}
            </p>
          ) : null}
          {mintError ? (
            <p className="sell-flow-mint-error" role="alert">
              {mintError}
            </p>
          ) : null}

          <div className="sell-flow-partner-cta">
            <TkButton
              type="button"
              variant="subtle"
              className="sell-flow-partner-back sell-flow-partner-btn--ghost"
              disabled={mintBusy || cards.length === 0}
              onClick={() => saveDraft()}
            >
              {draftSavedFlash ? "Saved" : "Save as draft"}
            </TkButton>
            <TkButton
              type="button"
              variant="primary"
              className="sell-flow-partner-register sell-flow-partner-btn--primary"
              disabled={!canContinueShipping || mintBusy}
              onClick={() => void continueToSelfMint()}
            >
              {mintBusy ? (
                <>
                  <span className="sell-flow-spinner" aria-hidden /> Minting…
                </>
              ) : (
                <>
                  Mint to portfolio <span className="tkl-mono" aria-hidden>→</span>
                </>
              )}
            </TkButton>
          </div>
          <p className="sell-flow-partner-footnote">
            Cards appear in your portfolio right away. Set prices there to put them up for sale.
          </p>
        </div>
      </section>

      {partnerMintSuccess !== null ? (
        <SellFlowPartnerDoneModal
          result={partnerMintSuccess}
          cards={cards}
          onAddMore={resetPartnerAddCards}
        />
      ) : null}
    </>
  );
}
