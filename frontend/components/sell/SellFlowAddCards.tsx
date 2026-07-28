"use client";

import { TkButton } from "@/components/ds";
import type { useSellFlow } from "@/hooks/sell/useSellFlow";
import { SellFlowProgressSteps } from "./SellFlowProgressSteps";

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

export function SellFlowAddCards({ flow }: { flow: Flow }) {
  const {
    cards,
    maxCards,
    certInput,
    setCertInput,
    certError,
    lookupBusy,
    draftSavedFlash,
    draftRestored,
    slabInputRef,
    canContinueShipping,
    lookupCert,
    scanSlab,
    onSlabFile,
    toggleConfirm,
    removeCard,
    saveDraft,
    continueToShipping,
    goToRegister,
  } = flow;

  return (
    <section className="sell-flow-screen">
      <div className="sell-flow-col sell-flow-col--narrow">
        <button type="button" className="sell-flow-back" onClick={goToRegister}>
          <BackChevron />
          Back to registration
        </button>

        <div className="sell-flow-eyebrow">Step 1 of 2</div>
        <h1 className="sell-flow-h1">Add your cards</h1>
        <p className="sell-flow-sub">
          Scan the QR on the slab or type the cert number. We&rsquo;ll pull the card details from
          PSA. You can add or remove cards anytime before you confirm shipment.
        </p>

        <SellFlowProgressSteps
          phase="submit"
          canGoShip={canContinueShipping}
          onShip={() => void continueToShipping()}
        />

        {draftRestored ? (
          <p className="sell-flow-draft-restored" role="status">
            Draft restored — your cards are still here from last time.
          </p>
        ) : null}

        <div className="sell-flow-glass sell-flow-glass--cards-input">
          <TkButton
            type="button"
            variant="subtle"
            className="sell-flow-scan-btn"
            disabled={lookupBusy}
            onClick={scanSlab}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
              <line x1="7" y1="12" x2="17" y2="12" />
            </svg>
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
              className="sell-flow-cert-input tkl-mono"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 12345678"
              autoComplete="off"
              disabled={lookupBusy}
              value={certInput}
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
              disabled={lookupBusy}
              onClick={() => void lookupCert()}
            >
              {lookupBusy ? <span className="sell-flow-spinner" aria-hidden /> : "Look up"}
            </TkButton>
          </div>
          {certError ? (
            <div className="sell-flow-cert-error" role="alert">
              {certError}
            </div>
          ) : null}
        </div>

        <div className="sell-flow-cards-section">
          <div className="sell-flow-cards-header">
            <div className="sell-flow-cards-title">
              Your cards{" "}
              <span className="tkl-mono sell-flow-cards-count">
                ({cards.length} of {maxCards})
              </span>
            </div>
          </div>
          <div className="sell-flow-cards-box">
            {cards.length === 0 ? (
              <div className="sell-flow-cards-empty">
                No cards yet.
                <br />
                Scan a slab or enter a cert number to get started.
              </div>
            ) : (
              <ul className="sell-flow-cards-list">
                {cards.map((card, i) => (
                  <li key={`${card.cert}-${i}`} className="sell-flow-cardrow">
                    {card.img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.img} alt="" className="sell-flow-cardrow__thumb" />
                    ) : (
                      <div className="sell-flow-cardrow__thumb sell-flow-cardrow__thumb--empty" />
                    )}
                    <div className="sell-flow-cardrow__body">
                      <div className="sell-flow-cardrow__name">{card.name}</div>
                      <div className="sell-flow-cardrow__meta">
                        <span className="sell-flow-grade tkl-mono">PSA {card.grade}</span>
                        <span className="tkl-mono sell-flow-cardrow__cert">Cert #{card.cert}</span>
                      </div>
                      <label className="sell-flow-cardrow__confirm">
                        <button
                          type="button"
                          className={`sell-flow-chk sell-flow-chk--sm${card.confirmed ? " sell-flow-chk--on" : ""}`}
                          aria-pressed={card.confirmed}
                          onClick={() => toggleConfirm(i)}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" aria-hidden>
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                        <span>Confirm this is your card</span>
                      </label>
                    </div>
                    <button
                      type="button"
                      className="sell-flow-cardrow__del"
                      aria-label={`Remove ${card.name}`}
                      title="Remove card"
                      onClick={() => removeCard(i)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="sell-flow-cards-cta">
          <TkButton type="button" variant="subtle" className="sell-flow-draft-btn" onClick={saveDraft}>
            {draftSavedFlash ? "Saved" : "Save as draft"}
          </TkButton>
          <TkButton
            type="button"
            variant="primary"
            className="sell-flow-ship-btn"
            disabled={!canContinueShipping}
            onClick={continueToShipping}
          >
            Continue to shipping <ArrowIcon />
          </TkButton>
        </div>
      </div>
    </section>
  );
}
