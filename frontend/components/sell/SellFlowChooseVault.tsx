"use client";

import Link from "next/link";
import { useState } from "react";
import { TkButton, TkDialog } from "@/components/ds";

type VaultChoice = "psa" | "self";

const STEPS = [
  { n: "1", tone: "blue", text: "Ship your PSA and BGS 10s to our vault" },
  { n: "2", tone: "blue", text: "We mint a token to your wallet" },
  { n: "3", tone: "green", text: "List and sell your token" },
] as const;

const AGREEMENT = [
  {
    title: "1. What this covers",
    body: "This agreement applies to every card you submit for vaulting with Tokenable, through PSA Vault or an approved partner vault.",
  },
  {
    title: "2. Intake and verification",
    body: "Cards sent to PSA Vault are checked against their PSA certification at intake. Cards that don't match, are damaged, or fall outside accepted grades may be rejected and returned.",
  },
  {
    title: "3. Storage and insurance",
    body: "Storage at PSA Vault is free. Cards stored at PSA Vault are insured for full replacement value. Approved partners hold their own cards and are responsible for them.",
  },
  {
    title: "4. Ownership",
    body: "You keep ownership of your card. A token is minted to your collection once the card is vaulted, and it moves only when you sell or transfer it.",
  },
  {
    title: "5. Redeeming",
    body: "You can request the physical card at any time. A per-card redemption fee and shipping apply, shown before you confirm.",
  },
] as const;

type Props = {
  choice: VaultChoice;
  onChoice: (choice: VaultChoice) => void;
  onContinue: () => void;
  /** Partner vault cannot continue until this is resolved. */
  partnerHold: "loading" | "address" | "not-partner" | null;
};

/**
 * First sell screen. Layout matches the sell-start reference:
 * title, three steps, vault choice, Vaulting Agreement, Continue.
 */
export function SellFlowChooseVault({
  choice,
  onChoice,
  onContinue,
  partnerHold,
}: Props) {
  const [agreed, setAgreed] = useState(false);
  const [agreementOpen, setAgreementOpen] = useState(false);
  const continueDisabled = !agreed || partnerHold != null;

  return (
    <section className="sell-flow-screen sell-flow-choice">
      <div className="sell-flow-col sell-flow-col--choice">
        <h1 className="sell-flow-choice__title">Sell your cards</h1>

        <ol className="sell-flow-choice__steps">
          {STEPS.map((step) => (
            <li key={step.n}>
              <span className={`sell-flow-choice__step-n sell-flow-choice__step-n--${step.tone}`}>
                {step.n}
              </span>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>

        <h2 className="sell-flow-choice__h2">Choose a vault</h2>

        <div className="sell-flow-vault-grid" role="listbox" aria-label="Vault">
          <button
            type="button"
            className={`sell-flow-vault-opt${choice === "psa" ? " sell-flow-vault-opt--sel" : ""}`}
            onClick={() => onChoice("psa")}
            aria-pressed={choice === "psa"}
            data-vault="psa"
          >
            <span className="sell-flow-vault-opt__ic sell-flow-vault-opt__ic--psa" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </span>
            <div className="sell-flow-vault-opt__title">PSA Vault</div>
            <div className="sell-flow-vault-opt__feats">
              <span className="sell-flow-vault-feat">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 7 12 12 15.5 14" />
                </svg>
                <span>
                  <span className="sell-flow-vault-feat__em">15+</span> days to intake at PSA
                </span>
              </span>
            </div>
            <span className="sell-flow-vault-opt__radio" aria-hidden />
          </button>

          <button
            type="button"
            className={`sell-flow-vault-opt${choice === "self" ? " sell-flow-vault-opt--sel" : ""}`}
            onClick={() => onChoice("self")}
            aria-pressed={choice === "self"}
            data-vault="self"
          >
            <span className="sell-flow-vault-opt__ic sell-flow-vault-opt__ic--self" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="12" cy="12" r="3" />
                <path d="M7 4v16M17 4v16" />
              </svg>
            </span>
            <div className="sell-flow-vault-opt__title">Approved Partners</div>
            <div className="sell-flow-vault-opt__feats">
              <span className="sell-flow-vault-feat">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                  <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
                </svg>
                <span>Approved partners can instantly vault their own cards.</span>
              </span>
            </div>
            <span className="sell-flow-vault-opt__radio" aria-hidden />
          </button>
        </div>

        {partnerHold === "address" ? (
          <p className="sell-flow-vault-hint sell-flow-vault-hint--partner" role="alert">
            Add your company vault address before using Approved Partners.{" "}
            <a className="sell-flow-link" href="/settings?section=addresses#partner-origin">
              Open Settings → Addresses
            </a>
            .
          </p>
        ) : null}
        {partnerHold === "not-partner" ? (
          <p className="sell-flow-vault-hint" role="status">
            Approved Partners is available to appointed partners.
          </p>
        ) : null}

        <div className="sell-flow-choice__agree">
          <input
            id="sell-vault-agree"
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>
            <label htmlFor="sell-vault-agree">I agree to the </label>
            <button
              type="button"
              className="sell-flow-link"
              onClick={() => setAgreementOpen(true)}
            >
              Vaulting Agreement
            </button>
          </span>
        </div>

        <div className="sell-flow-vault-cta sell-flow-vault-cta--solo sell-flow-choice__continue">
          <TkButton
            type="button"
            variant="primary"
            disabled={continueDisabled}
            onClick={onContinue}
          >
            Continue
          </TkButton>
        </div>
        <p>
          <Link href="/sell/catalog" className="sell-flow-link">
            List a catalog item
          </Link>
          {" · "}
          <Link href="/sell/listings" className="sell-flow-link">
            Your catalog listings
          </Link>
        </p>
      </div>

      <TkDialog
        open={agreementOpen}
        onClose={() => setAgreementOpen(false)}
        title="Vaulting Agreement"
        className="sell-flow-agreement"
      >
        {AGREEMENT.map((section) => (
          <section key={section.title} className="sell-flow-agreement__section">
            <h3 className="sell-flow-agreement__h">{section.title}</h3>
            <p className="sell-flow-agreement__p">{section.body}</p>
          </section>
        ))}
      </TkDialog>
    </section>
  );
}
