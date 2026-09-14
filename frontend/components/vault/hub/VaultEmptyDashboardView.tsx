import Link from "next/link";

const EMPTY_TABS = [
  { id: "all", label: "All" },
  { id: "transit", label: "Shipped" },
  { id: "verify", label: "Verifying" },
  { id: "vaulted", label: "Vaulted" },
  { id: "reject", label: "Rejected" },
] as const;

/** Empty sell hub — Vault-Dashboard-Active.html `#view-empty`. */
export function VaultEmptyDashboardView() {
  return (
    <div className="vault-hub-empty">
      <div className="vault-vtabs" role="tablist" aria-label="Vaulting status">
        {EMPTY_TABS.map((tab) => (
          <span
            key={tab.id}
            role="tab"
            aria-selected={tab.id === "all"}
            className={tab.id === "all" ? "vault-vtab vault-vtab--on" : "vault-vtab"}
          >
            {tab.label}
            <span className="vault-vtab__n">0</span>
          </span>
        ))}
      </div>
      <div className="vault-empty-state">
        <img
          className="vault-empty-state__art"
          src="/images/empty-box-pixel.png"
          alt=""
          width={130}
          height={130}
        />
        <div className="vault-empty-state__title">No cards in your vault yet</div>
        <p className="vault-empty-state__sub">
          Send a card to the vault and track its Shipped → Verifying → Vaulted progress right here.
        </p>
        <div className="vault-empty-state__actions">
          <Link href="/sell/flow" className="tk-btn tk-btn--primary vault-empty-state__btn">
            + Send a card to the vault
          </Link>
          <Link href="/markets" className="tk-btn tk-btn--subtle vault-empty-state__btn">
            Browse markets
          </Link>
        </div>
      </div>
    </div>
  );
}
