"use client";

import type { ReactNode } from "react";
import { TkButton } from "@/components/ds";
import type { useSellFlow } from "@/hooks/sell/useSellFlow";
import type { SellVaultChoice } from "@/lib/sell/sellFlowDraft";

type Flow = ReturnType<typeof useSellFlow>;

const PARTNER_SELF_VAULT_HINT =
  "Partner vault is a partner service for companies under contract with Tokenable. To apply, contact ";

/** Choose-Vault.html #hero-partner — partner vault first, PSA second, no pre-selection. */
const FAQ_ITEMS: { q: string; a: ReactNode }[] = [
  {
    q: "What is a vault?",
    a: (
      <>
        A way to hold your card so you can sell or trade it instantly without shipping anything each
        time. The real card stays safely stored; only ownership trades. With PSA Vault, PSA stores
        it; with Partner vault, a contracted partner stores it.
      </>
    ),
  },
  {
    q: "What's the difference between PSA Vault and Partner vault?",
    a: (
      <>
        <strong>PSA Vault</strong> — PSA verifies your card, stores it, insures it while stored, and
        ships it when someone redeems. <strong>Partner vault</strong> — a contracted partner stores
        it, attests to it, and ships it on redeem; it isn&rsquo;t independently PSA-verified or
        insured by the platform. Every listing shows which vault a card is in.
      </>
    ),
  },
  {
    q: "Can I choose Partner vault?",
    a: (
      <>
        Partner vault is only for contracted partners. If you&rsquo;re an individual seller, your card
        goes through <strong>PSA Vault</strong> — it&rsquo;s verified, insured while stored, and
        shipped for you.
      </>
    ),
  },
  {
    q: "Is my card insured?",
    a: (
      <>
        Cards in <strong>PSA Vault</strong> are insured while stored.{" "}
        <strong>Partner vault</strong> cards are not insured by the platform.
      </>
    ),
  },
  {
    q: "Should I trust a Partner vault listing when buying?",
    a: (
      <>
        Partner vault cards are held and attested by a contracted partner, but they&rsquo;re not
        independently PSA-verified or platform-insured. If you want independent verification and
        insured storage, choose a <strong>PSA Vault</strong> listing. The badge on every listing
        tells you which is which.
      </>
    ),
  },
  {
    q: "Are there fees?",
    a: (
      <>
        Storing a card is free. Fees apply when someone <strong>redeems</strong> — that covers the
        withdrawal and shipping. You&rsquo;ll see the exact cost before confirming, with no markup.
      </>
    ),
  },
  {
    q: "How do I get the physical card?",
    a: (
      <>
        Redeem it: pick the card(s), enter your address, review the cost, confirm and pay. For{" "}
        <strong>PSA Vault</strong>, PSA ships it from the vault; for <strong>Partner vault</strong>
        , the partner ships it. Once it arrives it shows as <strong>in your possession</strong>.
      </>
    ),
  },
  {
    q: "Can I sell a card without ever shipping it?",
    a: (
      <>
        Yes — that&rsquo;s the point. When it sells, ownership transfers instantly and the card stays
        in its vault. It only ships when someone redeems.
      </>
    ),
  },
  {
    q: "Who verifies the card is real?",
    a: (
      <>
        For <strong>PSA Vault</strong>, PSA grades and verifies it before listing. For{" "}
        <strong>Partner vault</strong>, the contracted partner attests to it; it isn&rsquo;t
        independently PSA-verified. The badge tells you which.
      </>
    ),
  },
];

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
    selfVaultPartnerOnly,
    selfVaultNeedsCompanyAddress,
  } = flow;

  const selfGated = !selfVaultEligible;

  const continueLabel =
    vaultChoice === "self"
      ? "Continue with partner vault"
      : vaultChoice === "psa"
        ? "Continue with PSA vault"
        : "Continue";

  const hint =
    selfVaultNeedsCompanyAddress && vaultChoice === "self"
      ? null
      : selfVaultPartnerOnly
        ? null
        : vaultChoice === "self" && selfVaultEligible
          ? "Your cards stay with you and are listed within minutes — no shipping, no review."
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
            title="Approved Partner Vaults"
            description={
              <>
                You vault the cards and sell right away.
                <br />
                Ship only when sold and delivery is requested.
              </>
            }
          />
          <VaultOption
            id="psa"
            selected={vaultChoice === "psa"}
            onSelect={() => selectVault("psa")}
            badge="Delivery time + 15 days intake"
            badgeTone="muted"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            }
            title="PSA Vaults"
            description={
              <>
                Ship to our PSA vault account.
                <br />
                All cards verified, secured, and insured by PSA.
              </>
            }
          />
        </div>

        <div className="sell-flow-vault-cta sell-flow-vault-cta--solo">
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

        {selfVaultNeedsCompanyAddress && vaultChoice === "self" ? (
          <p className="sell-flow-vault-hint sell-flow-vault-hint--partner" role="alert">
            Add your company vault address before using Partner vault.{" "}
            <a className="sell-flow-link" href="/settings?section=addresses#partner-origin">
              Open Settings → Addresses
            </a>
            .
          </p>
        ) : selfVaultPartnerOnly ? (
          <p className="sell-flow-vault-hint sell-flow-vault-hint--partner" role="alert">
            {PARTNER_SELF_VAULT_HINT}
            <a className="sell-flow-link" href="mailto:dev@tokenable.com">
              dev@tokenable.com
            </a>
            .
          </p>
        ) : hint ? (
          <p className="sell-flow-vault-hint">{hint}</p>
        ) : null}

        <div className="sell-flow-vault-faq-wrap">
          <h2 className="sell-flow-vault-sec-h">FAQs</h2>
          <p className="sell-flow-vault-sec-p">Answers for both sellers and buyers.</p>
          <div className="sell-flow-vault-faq">
            {FAQ_ITEMS.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
          <div className="sell-flow-vault-faq sell-flow-vault-faq--terms">
            <details>
              <summary>Terms and conditions</summary>
              <p>
                Vault storage, listing and redemption are covered by our{" "}
                <a href="/terms" className="sell-flow-link">
                  Terms of Service
                </a>
                ,{" "}
                <a href="/terms" className="sell-flow-link">
                  Seller Agreement
                </a>{" "}
                and{" "}
                <a href="/terms" className="sell-flow-link">
                  Vault Storage Terms
                </a>
                . Read them before you list.
              </p>
            </details>
          </div>
        </div>
      </div>
    </section>
  );
}
