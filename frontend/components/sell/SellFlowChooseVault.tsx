"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { TkButton, TkDialog } from "@/components/ds";

type VaultChoice = "psa" | "self";

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
  const t = useTranslations("Sell");
  const [agreed, setAgreed] = useState(false);
  const [agreementOpen, setAgreementOpen] = useState(false);
  const continueDisabled = !agreed || partnerHold != null;
  const steps = [
    { n: "1", tone: "blue", text: t("step1") },
    { n: "2", tone: "blue", text: t("step2") },
    { n: "3", tone: "green", text: t("step3") },
  ];
  const agreement = [
    { id: "1", title: t("agree1Title"), body: t("agree1Body") },
    { id: "2", title: t("agree2Title"), body: t("agree2Body") },
    { id: "3", title: t("agree3Title"), body: t("agree3Body") },
    { id: "4", title: t("agree4Title"), body: t("agree4Body") },
    { id: "5", title: t("agree5Title"), body: t("agree5Body") },
  ];

  return (
    <section className="sell-flow-screen sell-flow-choice">
      <div className="sell-flow-col sell-flow-col--choice">
        <h1 className="sell-flow-choice__title">{t("title")}</h1>

        <ol className="sell-flow-choice__steps">
          {steps.map((step) => (
            <li key={step.n}>
              <span className={`sell-flow-choice__step-n sell-flow-choice__step-n--${step.tone}`}>
                {step.n}
              </span>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>

        <h2 className="sell-flow-choice__h2">{t("chooseVault")}</h2>

        <div className="sell-flow-vault-grid" role="listbox" aria-label={t("vaultAria")}>
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
            <div className="sell-flow-vault-opt__title">{t("psaVault")}</div>
            <div className="sell-flow-vault-opt__feats">
              <span className="sell-flow-vault-feat">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 7 12 12 15.5 14" />
                </svg>
                <span>
                  <span className="sell-flow-vault-feat__em">{t("psaIntakeLead")}</span>{" "}
                  {t("psaIntakeRest")}
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
            <div className="sell-flow-vault-opt__title">{t("partners")}</div>
            <div className="sell-flow-vault-opt__feats">
              <span className="sell-flow-vault-feat">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                  <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
                </svg>
                <span>{t("partnersInstant")}</span>
              </span>
            </div>
            <span className="sell-flow-vault-opt__radio" aria-hidden />
          </button>
        </div>

        {partnerHold === "address" ? (
          <p className="sell-flow-vault-hint sell-flow-vault-hint--partner" role="alert">
            {t("needAddress")}{" "}
            <a className="sell-flow-link" href="/settings?section=addresses#partner-origin">
              {t("openAddresses")}
            </a>
            .
          </p>
        ) : null}
        {partnerHold === "not-partner" ? (
          <p className="sell-flow-vault-hint" role="status">
            {t("partnersOnly")}
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
            <label htmlFor="sell-vault-agree">{t("agree")} </label>
            <button
              type="button"
              className="sell-flow-link"
              onClick={() => setAgreementOpen(true)}
            >
              {t("agreement")}
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
            {t("continue")}
          </TkButton>
        </div>
      </div>

      <TkDialog
        open={agreementOpen}
        onClose={() => setAgreementOpen(false)}
        title={t("agreement")}
        className="sell-flow-agreement"
      >
        {agreement.map((section) => (
          <section key={section.id} className="sell-flow-agreement__section">
            <h3 className="sell-flow-agreement__h">{section.title}</h3>
            <p className="sell-flow-agreement__p">{section.body}</p>
          </section>
        ))}
      </TkDialog>
    </section>
  );
}
