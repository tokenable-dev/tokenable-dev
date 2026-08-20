import Link from "next/link";

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

/** Sell hub header — Vault-Dashboard-Active.html page-header (design system-2). */
export function VaultHubHeader({ showSubmitCta = true }: { showSubmitCta?: boolean }) {
  return (
    <div className="vault-hub-header">
      <div className="vault-hub-header__copy">
        <span className="vault-hub-header__eyebrow">Selling</span>
        <h1 className="vault-hub-header__title tkl-page-title">Track what you&rsquo;re selling</h1>
        <p className="vault-hub-header__sub">
          Get your cards verified and listed. Once live, manage them in your Portfolio.
        </p>
      </div>
      {showSubmitCta ? (
        <Link href="/sell/flow" className="vault-hub-header__cta tk-btn tk-btn--primary">
          + Sell a Card <ArrowIcon />
        </Link>
      ) : null}
    </div>
  );
}
