"use client";

import Link from "next/link";
import { TkButton } from "@/components/ds";

export function RedeemDonePanel() {
  return (
    <div className="pf-redeem-panel">
      <div className="pf-redeem-banner pf-redeem-banner--pos pf-redeem-banner--center">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <strong>They&rsquo;re yours now</strong>
        <p>
          Your cards are in your hands — the physical originals. They&rsquo;ve
          left your online assets and now show as “In your possession” in your
          portfolio.
        </p>
      </div>

      <div className="pf-redeem-return">
        <span className="pf-redeem-return__icon" aria-hidden>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <polyline points="3 4 3 9 8 9" />
          </svg>
        </span>
        <div className="pf-redeem-return__body">
          <strong>Changed your mind later?</strong>
          <p>
            Send a card back to the vault anytime and it&rsquo;s ready to sell
            online again.
          </p>
          <Link href="/sell/flow" className="pf-redeem-return__link">
            Send a card to the vault →
          </Link>
        </div>
      </div>

      <Link href="/portfolio" className="pf-redeem-primary-link">
        <TkButton type="button" variant="primary" className="pf-redeem-primary">
          Back to Portfolio
        </TkButton>
      </Link>
    </div>
  );
}
