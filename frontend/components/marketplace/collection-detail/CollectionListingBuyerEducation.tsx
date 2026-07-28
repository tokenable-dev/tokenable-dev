"use client";

/** What you'll get + Buyer protection — Card.html provenance (design system-2). */
export function CollectionListingBuyerEducation() {
  return (
    <>
      <div className="cd-listing-prov__wyg">
        <div className="cd-listing-prov__wyg-eyebrow tkl-mono">What you&apos;ll get</div>
        <p className="cd-listing-prov__wyg-body">
          The card stays in the vault. You&apos;ll own it right away and can resell it anytime — no
          shipping needed.
        </p>
      </div>

      <details className="cd-listing-prov__protect">
        <summary className="cd-listing-prov__protect-summary">
          <span>Buyer protection</span>
          <span className="cd-listing-prov__protect-view tkl-mono">View ↓</span>
        </summary>
        <div className="cd-listing-prov__protect-body">
          <p className="cd-listing-prov__protect-lead">
            Every card is graded, vaulted, and insured while in storage:
          </p>
          <div className="cd-listing-prov__protect-row">
            <span className="cd-listing-prov__protect-check" aria-hidden>
              ✓
            </span>
            <span>
              Held in a PSA or partner vault — insured against loss or damage while stored
            </span>
          </div>
          <div className="cd-listing-prov__protect-row">
            <span className="cd-listing-prov__protect-check" aria-hidden>
              ✓
            </span>
            <span>Ownership transfers instantly — no shipping, nothing to arrange</span>
          </div>
          <div className="cd-listing-prov__protect-row">
            <span className="cd-listing-prov__protect-check" aria-hidden>
              ✓
            </span>
            <span>Want the physical card? Withdraw it anytime from your portfolio</span>
          </div>
        </div>
      </details>
    </>
  );
}
