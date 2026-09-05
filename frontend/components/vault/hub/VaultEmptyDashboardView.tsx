import Link from "next/link";

/** Empty sell hub — Vault-Dashboard-Active.html `#view-empty`. */
export function VaultEmptyDashboardView() {
  return (
    <div className="vault-empty-state">
      <div className="vault-empty-state__lock" aria-hidden>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--azure)" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <div className="vault-empty-state__title">Send a card to the vault to start selling</div>
      <Link href="/sell/flow" className="vault-empty-state__cta tk-btn tk-btn--primary">
        Sell
      </Link>
    </div>
  );
}
