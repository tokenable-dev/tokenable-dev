"use client";

import { TkButton } from "@/components/ds";
import type { useSellFlow } from "@/hooks/sell/useSellFlow";
import { SellFlowCertProgress } from "./SellFlowCertProgress";
import { SellFlowYourCardsSection } from "./SellFlowYourCardsSection";

type Flow = ReturnType<typeof useSellFlow>;

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

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
          {vaultChoice === "self" ? "Partner vault" : "PSA Vault"}
        </div>
        <h1 className="sell-flow-h1">Add your cards</h1>
        <p className="sell-flow-sub">
          Scan the QR on the slab or type the cert number. We&rsquo;ll pull the card details from
          PSA.
        </p>

        <div className="sell-flow-glass sell-flow-glass--cards-input">
          <button
            type="button"
            className="sell-flow-scan-btn"
            disabled={busy}
            onClick={scanSlab}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
              <line x1="7" y1="12" x2="17" y2="12" />
            </svg>
            Scan slab
          </button>
          <input
            ref={slabInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            aria-hidden
            tabIndex={-1}
            onChange={(e) => void onSlabFile(e.target.files?.[0] ?? null)}
          />

          <div className="sell-flow-or">
            <div className="sell-flow-or__line" />
            <span className="sell-flow-or__label tkl-mono">OR</span>
            <div className="sell-flow-or__line" />
          </div>

          <label className="sell-flow-cert-label" htmlFor="sell-flow-cert">
            Cert number
          </label>
          <div className="sell-flow-cert-row">
            <input
              id="sell-flow-cert"
              className={`sell-flow-cert-input tkl-mono${certError ? " sell-flow-cert-input--error" : ""}`}
              type="text"
              inputMode="numeric"
              placeholder="e.g. 12345678"
              autoComplete="off"
              disabled={busy}
              value={certInput}
              aria-invalid={Boolean(certError)}
              aria-describedby={certError ? "cert-error" : undefined}
              onChange={(e) => setCertInput(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void lookupCert();
                }
              }}
            />
            <TkButton
              type="button"
              variant="primary"
              className="sell-flow-lookup-btn"
              disabled={busy}
              onClick={() => void lookupCert()}
            >
              {lookupBusy ? (
                <>
                  <span className="sell-flow-spinner" aria-hidden />
                  Looking up
                </>
              ) : (
                "Look up"
              )}
            </TkButton>
          </div>
          {/* Sell-Flow.html: progress under the cert row, error below that */}
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
            Continue to shipping{" "}
            <span className="sell-flow-ship-btn__icon" aria-hidden>
              <ArrowIcon />
            </span>
          </TkButton>
        </div>
      </div>
    </section>
  );
}
