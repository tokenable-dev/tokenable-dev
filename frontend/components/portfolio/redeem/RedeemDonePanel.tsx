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
        <strong>Redemption complete</strong>
        <p>
          Your cards are now in your hands. They&rsquo;ll show as “In your possession”
          in your portfolio — remove them anytime you like.
        </p>
      </div>
      <Link href="/portfolio" className="pf-redeem-primary-link">
        <TkButton type="button" variant="primary" className="pf-redeem-primary">
          Back to Portfolio
        </TkButton>
      </Link>
    </div>
  );
}
