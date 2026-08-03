"use client";

import Link from "next/link";
import { TkButton } from "@/components/ds";

export function RedeemRequestedPanel({ count }: { count: number }) {
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
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <div>
          <strong>Redemption requested</strong>
          <p>
            We received your request for {count} card{count === 1 ? "" : "s"}.
            We&rsquo;re confirming the exact cost with the vault. We&rsquo;ll notify you
            when it&rsquo;s ready to pay — no need to wait here.
          </p>
        </div>
      </div>
      <div className="pf-redeem-next">
        <div className="pf-redeem-next__title">What happens next</div>
        <div className="pf-redeem-next__steps">
          <div className="pf-redeem-next__step">
            <span className="pf-redeem-next__num tkl-mono pf-redeem-next__num--done">1</span>
            <span>We confirm your cards and calculate the exact shipping cost.</span>
          </div>
          <div className="pf-redeem-next__step">
            <span className="pf-redeem-next__num tkl-mono">2</span>
            <span>You&rsquo;ll get a notification when it&rsquo;s ready to pay.</span>
          </div>
          <div className="pf-redeem-next__step">
            <span className="pf-redeem-next__num tkl-mono">3</span>
            <span>Come back to pay and we&rsquo;ll ship your cards.</span>
          </div>
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
