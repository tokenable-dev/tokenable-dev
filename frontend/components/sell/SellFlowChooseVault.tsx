"use client";

import type { ReactNode } from "react";
import { TkButton } from "@/components/ds";
import type { useSellFlow } from "@/hooks/sell/useSellFlow";
import type { SellVaultChoice } from "@/lib/sell/sellFlowDraft";

type Flow = ReturnType<typeof useSellFlow>;

function CheckFeat({ tone = "pos" }: { tone?: "pos" | "warn" }) {
  if (tone === "warn") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="2.2" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="13" />
        <line x1="12" y1="16.5" x2="12.01" y2="16.5" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pos)" strokeWidth="2.6" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function VaultOption({
  id,
  selected,
  onSelect,
  badge,
  badgeTone,
  icon,
  title,
  description,
  features,
  gated = false,
}: {
  id: SellVaultChoice;
  selected: boolean;
  onSelect: () => void;
  badge: string;
  badgeTone: "pos" | "muted";
  icon: ReactNode;
  title: string;
  description: ReactNode;
  features?: { text: string; tone?: "pos" | "warn" }[];
  gated?: boolean;
}) {
  return (
    <button
      type="button"
      className={`sell-flow-vault-opt${selected ? " sell-flow-vault-opt--sel" : ""}${
        gated ? " sell-flow-vault-opt--gated" : ""
      }`}
      onClick={onSelect}
      aria-pressed={selected}
      data-vault={id}
    >
      <div className="sell-flow-vault-opt__head">
        <span className={`sell-flow-vault-opt__ic sell-flow-vault-opt__ic--${id}`}>{icon}</span>
        <span
          className={`sell-flow-vault-pill${
            badgeTone === "pos" ? " sell-flow-vault-pill--pos" : " sell-flow-vault-pill--muted"
          }`}
        >
          {badge}
        </span>
      </div>
      <div>
        <div className="sell-flow-vault-opt__title">{title}</div>
        <div className="sell-flow-vault-opt__desc">{description}</div>
      </div>
      {features && features.length > 0 ? (
        <div className="sell-flow-vault-opt__feats">
          {features.map((f) => (
            <span key={f.text} className="sell-flow-vault-feat">
              <CheckFeat tone={f.tone ?? "pos"} />
              {f.text}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  );
}

export function SellFlowChooseVault({ flow }: { flow: Flow }) {
  const {
    vaultChoice,
    selectVault,
    continueFromVault,
    goToRegister,
    canContinueVault,
    selfVaultEligible,
    selfVaultNeedsCompanyAddress,
  } = flow;

  const selfGated = !selfVaultEligible;

  const continueLabel =
    vaultChoice === "self"
      ? "Continue with Tokenable Vault"
      : vaultChoice === "psa"
        ? "Continue with PSA Vault"
        : "Continue";

  const hint =
    vaultChoice === "self"
      ? "Confirmed cards are listed straight from your Tokenable Vault · no shipping, no review."
      : vaultChoice === "psa"
        ? "You'll ship these cards to PSA to be verified before they go live."
        : "Pick a vault to continue.";

  return (
    <section className="sell-flow-screen">
      <div className="sell-flow-col sell-flow-col--vault">
        <button type="button" className="sell-flow-vault-back-top" onClick={goToRegister}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>

        <div className="sell-flow-eyebrow">Choose a vault</div>
        <h1 className="sell-flow-h1">How do you want to list these cards?</h1>
        <p className="sell-flow-sub">
          List straight from your own vault, or send the cards to PSA to be verified first.
        </p>

        <div className="sell-flow-vault-grid">
          <VaultOption
            id="psa"
            selected={vaultChoice === "psa"}
            onSelect={() => selectVault("psa")}
            badge="14–16 BUSINESS DAYS AFTER ARRIVAL"
            badgeTone="muted"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            }
            title="PSA Vault"
            description="Send them to PSA. Once verified, your listing goes live."
            features={[
              { text: "Verified by PSA before it goes live" },
              { text: "Requires shipping and intake review", tone: "warn" },
            ]}
          />
          <VaultOption
            id="self"
            selected={vaultChoice === "self"}
            onSelect={() => selectVault("self")}
            gated={selfGated}
            badge="INSTANT"
            badgeTone="pos"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="12" cy="12" r="3" />
                <path d="M7 4v16M17 4v16" />
              </svg>
            }
            title="Tokenable Vault"
            description="Cards you already hold. List them right away · no shipping, no review."
            features={[
              { text: "Listed within minutes" },
              { text: "Stays in your own vault" },
              { text: "You attest to authenticity and condition", tone: "warn" },
            ]}
          />
        </div>

        {hint ? <p className="sell-flow-vault-hint">{hint}</p> : null}

        {vaultChoice === "self" && selfVaultNeedsCompanyAddress ? (
          <p className="sell-flow-vault-hint sell-flow-vault-hint--partner" role="alert">
            Add your company vault address before using Tokenable Vault.{" "}
            <a className="sell-flow-link" href="/settings?section=addresses#partner-origin">
              Open Settings → Addresses
            </a>
            .
          </p>
        ) : null}

        <div className="sell-flow-vault-cta sell-flow-vault-cta--solo">
          <TkButton
            type="button"
            variant="primary"
            disabled={!canContinueVault}
            onClick={continueFromVault}
          >
            {continueLabel}
          </TkButton>
        </div>
      </div>
    </section>
  );
}
