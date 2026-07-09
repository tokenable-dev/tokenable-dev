import Link from "next/link";

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export function VaultHubHeader({ showSubmitCta = true }: { showSubmitCta?: boolean }) {
  return (
    <div className="vault-hub-header">
      <div>
        <span className="vault-hub-header__eyebrow">My Vault</span>
        <h1 className="vault-hub-header__title">Track your card submissions</h1>
      </div>
      {showSubmitCta ? (
        <Link href="/vault/submit" className="vault-hub-header__cta tk-btn tk-btn--primary">
          + Submit a Card <ArrowIcon />
        </Link>
      ) : null}
    </div>
  );
}
