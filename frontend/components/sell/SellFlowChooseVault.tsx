"use client";

import type { ReactNode } from "react";
import { TkButton } from "@/components/ds";
import type { useSellFlow } from "@/hooks/sell/useSellFlow";
import type { SellVaultChoice } from "@/lib/sell/sellFlowDraft";

type Flow = ReturnType<typeof useSellFlow>;

const PARTNER_SELF_VAULT_HINT =
  "Self vault is a partner service for companies under contract with Tokenable. To apply, contact ";

const FAQ_ITEMS: { q: string; a: ReactNode }[] = [
  {
    q: "What is a vault?",
    a: "A vault is where a card sits while it is listed and traded. Because the card stays in one place, it can be bought and sold without being shipped each time. When you want the physical card, you redeem it.",
  },
  {
    q: "What is the difference between PSA Vault and Self vault?",
    a: "With PSA Vault the card is sent to PSA, checked against its certification, and stored and insured there. With Self vault the owner keeps the card. We do not hold it, do not verify it and do not insure it.",
  },
  {
    q: "Which one should I choose?",
    a: "Choose PSA Vault if you want the card verified and stored before it goes live, and you can wait for shipping and intake. Choose Self vault if you want to list today and you are comfortable standing behind the card yourself.",
  },
  {
    q: "Is my card insured?",
    a: "Cards are insured while they are stored at PSA Vault. Self vault cards are not insured by us — they stay in the owner's hands and under the owner's own arrangements.",
  },
  {
    q: "If I sell a Self vault card, what am I responsible for?",
    a: "Everything about the card. You confirm it is authentic, that the grade and cert number are correct, and that its condition matches your listing. You also ship it to the buyer when the sale requires it. If the card is not as described, that is on you, not on us.",
  },
  {
    q: "Should I trust a Self vault listing when buying?",
    a: "Judge it on its own. A Self vault card has not been checked by us or by PSA at listing time, and it is not held by us. The trust is between you and the seller. If you want a card that was verified before listing, look for the PSA Vault badge.",
  },
  {
    q: "Are there fees?",
    a: "Yes. Listing and selling carry a platform fee, and PSA Vault adds storage and intake costs. Redeeming a card has a shipping and handling cost, charged at what it costs — with no markup. The exact amounts are shown before you confirm anything.",
  },
  {
    q: "How do I get the physical card?",
    a: "Redeem it. You enter a shipping address, review the cost, and confirm. For PSA Vault, PSA ships from the vault. For Self vault, the owner ships it themselves. See the redemption steps in your portfolio for details.",
  },
  {
    q: "Can I sell without ever shipping?",
    a: "If the card is in PSA Vault, yes — it stays in the vault and ownership transfers to the buyer. With Self vault the card is in your hands, so shipping is your responsibility when the buyer wants it.",
  },
  {
    q: "Who verifies the card is real?",
    a: "PSA does, for cards sent to PSA Vault — each card is matched to its certification at intake. For Self vault cards nobody verifies them on our side; the seller alone stands behind the card.",
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
  description: string;
  features: { text: string; tone?: "pos" | "warn" }[];
  /** Individual sellers: Self vault stays selectable but visually unavailable. */
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

/** Choose-Vault Individual — PSA first, Self vault gated for non-partners + FAQ. */
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
      ? "Continue with self vault"
      : vaultChoice === "psa"
        ? "Continue with PSA vault"
        : "Continue";

  const hint =
    selfVaultPartnerOnly || selfVaultNeedsCompanyAddress
      ? null
      : vaultChoice === "self" && selfVaultEligible
        ? "Confirmed cards are listed straight from your own vault — no shipping, no review."
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
            title="PSA vault"
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
            title="Self vault"
            description="Cards you already hold. List them right away — no shipping, no review."
            features={[
              { text: "Listed within minutes" },
              { text: "Stays in your own vault" },
              { text: "You attest to authenticity and condition", tone: "warn" },
            ]}
          />
        </div>

        <p
          className={`sell-flow-vault-hint${
            selfVaultPartnerOnly || selfVaultNeedsCompanyAddress
              ? " sell-flow-vault-hint--partner"
              : ""
          }`}
          role={
            selfVaultPartnerOnly || selfVaultNeedsCompanyAddress
              ? "alert"
              : undefined
          }
        >
          {selfVaultNeedsCompanyAddress ? (
            <>
              Add your company vault address before using Self vault.{" "}
              <a className="sell-flow-link" href="/settings?section=addresses#partner-origin">
                Open Settings → Addresses
              </a>
              .
            </>
          ) : selfVaultPartnerOnly ? (
            <>
              {PARTNER_SELF_VAULT_HINT}
              <a className="sell-flow-link" href="mailto:dev@tokenable.com">
                dev@tokenable.com
              </a>
              .
            </>
          ) : (
            hint
          )}
        </p>

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

        <div className="sell-flow-vault-faq-wrap">
          <h2 className="sell-flow-vault-sec-h">FAQ</h2>
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
              <summary>Terms &amp; conditions</summary>
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
