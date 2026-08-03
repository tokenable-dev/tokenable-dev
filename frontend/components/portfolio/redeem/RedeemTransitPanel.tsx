"use client";

import Link from "next/link";
import { TkButton } from "@/components/ds";
import type { RedeemDraftCard } from "@/lib/portfolio/redeemDraft";
import { RedeemCardSummary } from "./RedeemCardSummary";

export function RedeemTransitPanel({
  cards,
}: {
  cards: RedeemDraftCard[];
}) {
  return (
    <div className="pf-redeem-panel">
      <div className="pf-redeem-banner pf-redeem-banner--azure">
        <svg
          className="pf-redeem-banner__icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
        <div>
          <strong>Your cards are on their way</strong>
          <p>
            Confirm once your cards arrive so we can complete the redemption.
          </p>
        </div>
      </div>

      {cards.length > 0 ? <RedeemCardSummary cards={cards} /> : null}

      <div className="pf-redeem-shipment">
        <div className="pf-redeem-shipment__title">
          Shipment · PSA Vault ({cards.length || "—"} cards)
        </div>
        <div className="pf-redeem-shipment__meta tkl-mono">
          <div>
            <span className="pf-redeem-shipment__k">Carrier</span>
            <span>Pending</span>
          </div>
          <div>
            <span className="pf-redeem-shipment__k">Tracking</span>
            <span>Pending</span>
          </div>
          <div>
            <span className="pf-redeem-shipment__k">Est. delivery</span>
            <span>Pending</span>
          </div>
        </div>
        <p className="pf-redeem-shipment__copy">
          Tracking details appear here after ops confirms physical release.
        </p>
      </div>

      <TkButton type="button" variant="primary" className="pf-redeem-primary" disabled>
        I&apos;ve received my cards
      </TkButton>
      <p className="pf-redeem-cost__copy" style={{ textAlign: "center" }}>
        Receipt confirmation ships in a later update.
      </p>
      <Link href="/portfolio" className="pf-redeem-primary-link">
        <TkButton type="button" variant="subtle" className="pf-redeem-primary">
          Back to Portfolio
        </TkButton>
      </Link>
    </div>
  );
}
