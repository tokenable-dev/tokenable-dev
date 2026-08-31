"use client";

import Link from "next/link";
import { TkButton } from "@/components/ds";
import type { useSellFlow } from "@/hooks/sell/useSellFlow";
import { SellFlowCertProgress } from "./SellFlowCertProgress";
import { SellFlowPartnerDoneModal } from "./SellFlowPartnerDoneModal";
import { SellFlowYourCardsSection } from "./SellFlowYourCardsSection";

type Flow = ReturnType<typeof useSellFlow>;

function ScanIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

/** Partner-Add-Cards.html — partner vault bulk scan + mint. */
export function SellFlowPartnerAddCards({ flow }: { flow: Flow }) {
  const {
    cards,
    maxCards,
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
    resetPartnerAddCards,
  } = flow;

  const busy = lookupBusy || mintBusy;
  const allConfirmed = cards.length > 0 && cards.every((c) => c.confirmed);
  const confirmedCount = cards.filter((c) => c.confirmed).length;
  const registerTotal = confirmedCount > 0 ? confirmedCount : cards.length;
  const registerLabel =
    registerTotal > 0
      ? `Add ${registerTotal} card${registerTotal === 1 ? "" : "s"} to my vault`
      : "Add to my vault";

  return (
    <>
      <section className="sell-flow-screen sell-flow-screen--partner">
        <div className="sell-flow-col sell-flow-col--partner">
          <nav className="sell-flow-partner-crumb" aria-label="Breadcrumb">
            <Link href="/vault">Sell</Link>
            <span className="sell-flow-partner-crumb__sep" aria-hidden>
              ›
            </span>
            <button type="button" className="sell-flow-partner-crumb__link" onClick={goBackToVaultChoice}>
              Choose a vault
            </button>
            <span className="sell-flow-partner-crumb__sep" aria-hidden>
              ›
            </span>
            <span className="sell-flow-partner-crumb__current">Partner vault</span>
          </nav>

          <div className="sell-flow-eyebrow">Partner vault</div>
          <h1 className="sell-flow-h1">Scan the cards you want to list</h1>
          <p className="sell-flow-sub sell-flow-sub--partner">
            Scan the slab QR or type the cert number. Cards stay in your vault.
          </p>

          <div className="sell-flow-glass sell-flow-glass--partner-input">
            <TkButton
              type="button"
              variant="subtle"
              className="sell-flow-scan-btn sell-flow-partner-btn--ghost"
              disabled={busy}
              onClick={scanSlab}
            >
              <ScanIcon />
              Scan slab
            </TkButton>
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

            <div className="sell-flow-or sell-flow-or--partner">
              <div className="sell-flow-or__line" />
              <span className="sell-flow-or__label tkl-mono">OR</span>
              <div className="sell-flow-or__line" />
            </div>

            <label className="sell-flow-partner-cert-label" htmlFor="sell-flow-partner-cert">
              Cert number
            </label>
            <div className="sell-flow-cert-row">
              <input
                id="sell-flow-partner-cert"
                className="sell-flow-partner-cert-input tkl-mono"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 12345678"
                autoComplete="off"
                disabled={busy}
                value={certInput}
                onChange={(e) =>
                  setCertInput(e.target.value.replace(/[^\d]/g, "").slice(0, 10))
                }
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
                className="sell-flow-lookup-btn sell-flow-partner-btn--primary"
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
            <SellFlowCertProgress active={lookupBusy} tone="light" />
            {certError ? (
              <p className="sell-flow-partner-cert-error" role="alert">
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
              disabled={mintBusy}
              onClick={goBackToVaultChoice}
            >
              Back
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
                  <span className="sell-flow-spinner" aria-hidden /> Adding…
                </>
              ) : (
                registerLabel
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
          onAddMore={resetPartnerAddCards}
        />
      ) : null}
    </>
  );
}
