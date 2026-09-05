"use client";

import { useState, type ReactNode } from "react";
import { TkButton } from "@/components/ds";

type FaqItem = { q: string; a: ReactNode };
type FaqGroup = { heading: string; items: FaqItem[] };

const FAQ_GROUPS: FaqGroup[] = [
  {
    heading: "Payments and funding",
    items: [
      {
        q: "Do I need crypto or a wallet to buy?",
        a: "No. Sign in with your email and a secure wallet is created for you automatically · nothing to install or set up. Pay with a card or with crypto, whichever you prefer.",
      },
      {
        q: "How do I add funds?",
        a: "Add funds to your balance with a debit or credit card (processed by MoonPay), or by sending crypto. Your balance is held in US dollars, so you always trade against a clear USD amount.",
      },
      {
        q: "Can I pay with a credit or debit card?",
        a: "Yes · including Apple Pay and Google Pay, through MoonPay. Use it to add funds or to check out.",
      },
      {
        q: "What currency is my balance in?",
        a: "US dollars. Prices and fees are shown in USD so there are no surprises. (Balances are held as USDC under the hood.)",
      },
      {
        q: "Can I cash out?",
        a: "Yes. Withdraw your balance anytime · back to your card/bank or to crypto. You’ll see the amount and destination before you confirm.",
      },
    ],
  },
  {
    heading: "Buying",
    items: [
      {
        q: "How does buying a card work?",
        a: "Every card is already graded and vaulted. When you buy, you own it instantly and the physical card stays safely in the vault · no shipping required unless you choose to redeem it.",
      },
      {
        q: "What fees do I pay when I buy?",
        a: (
          <>
            Just the item price plus a small flat <strong>network and settlement fee</strong> (currently{" "}
            <strong>$15</strong>) shown at checkout. There’s no percentage fee for buyers. Example: a $9,000 card is
            $9,015 total.
          </>
        ),
      },
      {
        q: "Do I pay gas or network fees?",
        a: "No meaningful ones · trades settle instantly on-platform. Any blockchain network cost is minimal and passed through, not a Tokenable markup.",
      },
      {
        q: "What does “Choose your copy” mean?",
        a: "When several identical-grade cards are listed at the same price, you pick the exact copy · each has its own cert number, vault and seller. Same price, but you choose the individual card.",
      },
    ],
  },
  {
    heading: "Custody and ownership",
    items: [
      {
        q: "Where is my card physically kept?",
        a: "In an insured, access-controlled vault (PSA Vault or a partner vault). You own it outright; ownership is recorded to your account and independently verifiable.",
      },
      {
        q: "How do I prove I own it?",
        a: (
          <>
            Your <strong>Certificate of Ownership</strong> shows the cert number and dated vault audits · all
            independently verifiable via PSA lookup.
          </>
        ),
      },
      {
        q: "Is my card insured?",
        a: (
          <>
            Cards are insured for full replacement value while stored at <strong>PSA Vault</strong>. Partner-vault
            cards are not insured by us · they stay in the owner’s hands under their own arrangements.
          </>
        ),
      },
    ],
  },
  {
    heading: "Vaults",
    items: [
      {
        q: "What is a vault?",
        a: "A vault is where a card sits while it is listed and traded. Because the card stays in one place, it can be bought and sold without being shipped each time. When you want the physical card, you redeem it.",
      },
      {
        q: "What’s the difference between PSA Vault and Partner vault?",
        a: (
          <>
            With <strong>PSA Vault</strong> the card is sent to PSA, checked against its certification, and stored
            and insured there. With <strong>Partner vault</strong> the owner keeps the card · we do not hold it, verify
            it or insure it.
          </>
        ),
      },
      {
        q: "Which vault should I choose?",
        a: (
          <>
            Choose <strong>PSA Vault</strong> if you want the card verified and stored before it goes live, and can
            wait for shipping and intake. Choose <strong>Partner vault</strong> if you want to list today and are
            comfortable standing behind the card yourself.
          </>
        ),
      },
      {
        q: "If I sell a Partner-vault card, what am I responsible for?",
        a: "Everything about the card · you confirm it is authentic, that the grade and cert number are correct, and that its condition matches your listing. You also ship it to the buyer when the sale requires it.",
      },
      {
        q: "Should I trust a Partner-vault listing when buying?",
        a: (
          <>
            Judge it on its own. A Partner-vault card has not been checked by us or PSA at listing time and is not
            held by us · the trust is between you and the seller. For a card verified before listing, look for the{" "}
            <strong>PSA Vault</strong> badge.
          </>
        ),
      },
      {
        q: "Who verifies the card is real?",
        a: "PSA does, for cards sent to PSA Vault · each card is matched to its certification at intake. Partner-vault cards are not verified on our side; the seller alone stands behind the card.",
      },
    ],
  },
  {
    heading: "Selling",
    items: [
      {
        q: "How do I sell a card I own?",
        a: (
          <>
            Open the card and choose <strong>Sell / List</strong>. First-time sellers complete a one-time identity
            verification (KYC); after that you just confirm the seller terms and set a price.
          </>
        ),
      },
      {
        q: "What fees do I pay when I sell?",
        a: (
          <>
            A <strong>5% platform fee</strong> on the sale, taken from your proceeds (e.g. sell at $25,000 → you
            receive $23,750). PSA Vault also carries storage and intake costs. These are shown before you confirm.
          </>
        ),
      },
      {
        q: "When is the selling fee charged?",
        a: "Nothing is charged to list. The 5% fee applies only when a sale settles.",
      },
    ],
  },
  {
    heading: "Redemption",
    items: [
      {
        q: "Can I get the physical card shipped to me?",
        a: (
          <>
            Anytime. Choose <strong>Ship from vault</strong> to redeem the physical card to your address · fully
            insured door-to-door.
          </>
        ),
      },
      {
        q: "What does it cost to get the physical card (redeem)?",
        a: (
          <>
            A per-card <strong>Redemption fee</strong> plus shipping at cost. Shown before you confirm.
          </>
        ),
      },
      {
        q: "How long does shipping take?",
        a: "Most redemptions ship within 5 business days of the request being approved.",
      },
    ],
  },
];

function FaqChevron() {
  return (
    <svg className="faq-page__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function FaqPage() {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <section className="faq-page">
      <span className="faq-page__eyebrow">Help center</span>
      <h1 className="faq-page__title">Frequently asked questions</h1>
      <p className="faq-page__sub">
        Everything about buying, selling, custody and redemption on Tokenable. Can&rsquo;t find it?{" "}
        <a className="faq-page__tlink" href="mailto:dev@tokenable.io">
          Contact support
        </a>
        .
      </p>

      <div className="faq-page__groups">
        {FAQ_GROUPS.map((group) => (
          <div key={group.heading} className="faq-page__group">
            <h2 className="faq-page__group-h">{group.heading}</h2>
            {group.items.map((item) => {
              const id = `${group.heading}:${item.q}`;
              const isOpen = Boolean(open[id]);
              return (
                <div key={item.q} className={`faq-page__item${isOpen ? " faq-page__item--open" : ""}`}>
                  <button
                    type="button"
                    className="faq-page__q"
                    aria-expanded={isOpen}
                    onClick={() => setOpen((prev) => ({ ...prev, [id]: !prev[id] }))}
                  >
                    {item.q}
                    <FaqChevron />
                  </button>
                  <div className="faq-page__a">
                    <div className="faq-page__a-inner">{item.a}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="faq-page__cta">
        <div>
          <h2>Still have a question?</h2>
          <p>Our team replies within one business day.</p>
        </div>
        <TkButton href="mailto:dev@tokenable.io" variant="primary" className="faq-page__cta-btn">
          Contact support
        </TkButton>
      </div>
    </section>
  );
}
