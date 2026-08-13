"use client";

import { TkButton } from "@/components/ds";
import type { useSellFlow } from "@/hooks/sell/useSellFlow";

type Flow = ReturnType<typeof useSellFlow>;

function ConsentCheck({ on }: { on: boolean }) {
  return (
    <span
      className={`sell-flow-chk${on ? " sell-flow-chk--on" : ""}`}
      aria-hidden
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

/** Sell-Flow.html screen 1 — KYC + seller consents (no Submit→Ship progress rail here). */
export function SellFlowRegister({ flow }: { flow: Flow }) {
  const {
    idState,
    consents,
    allConsentsOn,
    canContinueRegister,
    requiredConsentsOk,
    updateConsent,
    startVerification,
    goToVault,
  } = flow;

  const gateHint =
    canContinueRegister
      ? null
      : idState !== "verified"
        ? "Verify your identity to continue."
        : !requiredConsentsOk
          ? "Accept the required seller terms to continue."
          : null;

  return (
    <section className="sell-flow-screen">
      <div className="sell-flow-col sell-flow-col--narrow">
        <div className="sell-flow-eyebrow">Seller verification</div>
        <h1 className="sell-flow-h1">Verify your identity to start selling</h1>
        <p className="sell-flow-sub">
          Identity verification is one-time. Confirm the seller terms for each submission.
        </p>

        <div
          className={`sell-flow-glass sell-flow-glass--identity${
            idState === "verified" ? " sell-flow-glass--dim" : ""
          }`}
        >
          <div className="sell-flow-id-top">
            <div>
              <div className="sell-flow-id-title">Identity verification</div>
              <p className="sell-flow-id-copy">
                We use Sumsub to confirm it&rsquo;s really you. You&rsquo;ll photograph your ID and
                take a selfie.
              </p>
            </div>
            <div
              className={`sell-flow-id-icon${
                idState === "verified"
                  ? " sell-flow-id-icon--ok"
                  : idState === "failed"
                    ? " sell-flow-id-icon--bad"
                    : ""
              }`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--azure)" strokeWidth="2" aria-hidden>
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="9" cy="10" r="2" />
                <path d="M13 9h5M13 13h5M5 16c1-2 3-2 4 0" />
              </svg>
            </div>
          </div>

          <div className="sell-flow-id-state">
            {idState === "idle" ? (
              <TkButton
                type="button"
                variant="primary"
                className="sell-flow-id-cta"
                onClick={startVerification}
              >
                Start verification
              </TkButton>
            ) : null}
            {idState === "review" ? (
              <div className="sell-flow-status-chip sell-flow-status-chip--azure">
                <span className="sell-flow-spinner" aria-hidden />
                Under review — usually under a minute, up to 24 hours
              </div>
            ) : null}
            {idState === "verified" ? (
              <div className="sell-flow-status-chip sell-flow-status-chip--pos">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Verified
              </div>
            ) : null}
            {idState === "failed" ? (
              <div className="sell-flow-id-failed">
                <div className="sell-flow-status-chip sell-flow-status-chip--neg sell-flow-status-chip--mb">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  We couldn&rsquo;t verify your ID
                </div>
                <p className="sell-flow-id-failed-copy">
                  Check that your ID is fully visible and try again.
                </p>
                <TkButton type="button" variant="subtle" className="sell-flow-id-retry" onClick={startVerification}>
                  Try again
                </TkButton>
              </div>
            ) : null}
          </div>
        </div>

        <div className="sell-flow-glass sell-flow-glass--consent">
          <div className="sell-flow-consent-title">Seller agreement &amp; consents</div>
          <button
            type="button"
            className="sell-flow-consent-row sell-flow-consent-row--master"
            onClick={() => updateConsent("all")}
          >
            <ConsentCheck on={allConsentsOn} />
            <span className="sell-flow-consent-strong">Agree to all</span>
          </button>
          <div className="sell-flow-consent-list">
            <button type="button" className="sell-flow-consent-row" onClick={() => updateConsent("terms")}>
              <ConsentCheck on={consents.terms} />
              <span>
                I agree to the{" "}
                <a href="/terms" className="sell-flow-link" onClick={(e) => e.stopPropagation()}>
                  Seller Agreement
                </a>{" "}
                and{" "}
                <a href="/terms" className="sell-flow-link" onClick={(e) => e.stopPropagation()}>
                  Terms of Use
                </a>
                . <span className="sell-flow-req">*</span>
              </span>
            </button>
            <button
              type="button"
              className="sell-flow-consent-row"
              onClick={() => updateConsent("authenticity")}
            >
              <ConsentCheck on={consents.authenticity} />
              <span>
                I&rsquo;m responsible for the authenticity of the cards I list. PSA verifies cert
                numbers; Tokenable doesn&rsquo;t authenticate cards.{" "}
                <span className="sell-flow-req">*</span>
              </span>
            </button>
            <button type="button" className="sell-flow-consent-row" onClick={() => updateConsent("storage")}>
              <ConsentCheck on={consents.storage} />
              <span>
                My cards are stored at PSA Vault. I agree to the{" "}
                <a href="/terms" className="sell-flow-link" onClick={(e) => e.stopPropagation()}>
                  storage and shipping terms
                </a>
                . <span className="sell-flow-req">*</span>
              </span>
            </button>
          </div>
          <div className="sell-flow-consent-note">
            <span className="sell-flow-req">*</span> Required to sell.
          </div>
        </div>

        <div className="sell-flow-reg-cta">
          <TkButton
            type="button"
            variant="primary"
            className="sell-flow-continue"
            disabled={!canContinueRegister}
            onClick={goToVault}
          >
            Continue
          </TkButton>
          {gateHint ? <p className="sell-flow-gate-hint">{gateHint}</p> : null}
        </div>
      </div>
    </section>
  );
}
