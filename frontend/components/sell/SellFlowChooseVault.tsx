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
        <line x1="12" y1="16.5" x2="12" y2="16.5" />
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
}: {
  id: SellVaultChoice;
  selected: boolean;
  onSelect: () => void;
  badge: string;
  badgeTone: "pos" | "muted";
  icon: ReactNode;
  title: string;
  description: string;
  features: { text: string; tone?: "pos" | "warn" }[];
}) {
  return (
    <button
      type="button"
      className={`sell-flow-vault-opt${selected ? " sell-flow-vault-opt--sel" : ""}`}
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
      <div className="sell-flow-vault-opt__feats">
        {features.map((f) => (
          <span key={f.text} className="sell-flow-vault-feat">
            <CheckFeat tone={f.tone ?? "pos"} />
            {f.text}
          </span>
        ))}
      </div>
    </button>
  );
}

/** Choose-Vault.html / Sell-Flow scr-choice — after register, before add cards. */
export function SellFlowChooseVault({ flow }: { flow: Flow }) {
  const {
    vaultChoice,
    selectVault,
    continueFromVault,
    goToRegister,
    canContinueVault,
  } = flow;

  const continueLabel =
    vaultChoice === "self"
      ? "Continue with self vault"
      : vaultChoice === "psa"
        ? "Continue with PSA vault"
        : "Continue";

  const hint =
    vaultChoice === "self"
      ? "Your cards stay in your vault and can be listed right away."
      : vaultChoice === "psa"
        ? "You’ll ship these cards to PSA to be verified before they go live."
        : "Pick a vault to continue.";

  return (
    <section className="sell-flow-screen">
      <div className="sell-flow-col sell-flow-col--vault">
        <div className="sell-flow-eyebrow">Choose a vault</div>
        <h1 className="sell-flow-h1">How do you want to list these cards?</h1>
        <p className="sell-flow-sub">
          List straight from your own vault, or send the cards to PSA to be verified first.
        </p>

        <div className="sell-flow-vault-grid">
          <VaultOption
            id="self"
            selected={vaultChoice === "self"}
            onSelect={() => selectVault("self")}
            badge="INSTANT"
            badgeTone="pos"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="12" cy="12" r="3" />
                <path d="M7 4v16M17 4v16" />
              </svg>
            }
            title="Self vault"
            description="Cards you already hold. List them right away — no shipping, no review."
            features={[
              { text: "Listed within minutes" },
              { text: "Stays in your own vault" },
              { text: "You attest to authenticity and condition", tone: "warn" },
            ]}
          />
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
            title="PSA vault"
            description="Send them to PSA. Once verified, your listing goes live."
            features={[
              { text: "Verified by PSA before it goes live" },
              { text: "Requires shipping and intake review", tone: "warn" },
            ]}
          />
        </div>

        <div className="sell-flow-vault-cta">
          <TkButton type="button" variant="subtle" className="sell-flow-vault-back" onClick={goToRegister}>
            Back
          </TkButton>
          <TkButton
            type="button"
            variant="primary"
            className="sell-flow-vault-continue"
            disabled={!canContinueVault}
            onClick={continueFromVault}
          >
            {continueLabel}
          </TkButton>
        </div>
        <p className="sell-flow-vault-hint">{hint}</p>
      </div>
    </section>
  );
}
