function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 12l2 2 4-4" />
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function TradeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

export function VaultFeatures() {
  return (
    <section className="vault-features" aria-label="Vault benefits">
      <article className="vault-feat">
        <div className="vault-feat__icon vault-feat__icon--pos">
          <CheckIcon />
        </div>
        <h3>Authentication</h3>
        <p>PSA-graded cards only. Each cert is verified against PSA records before mint.</p>
      </article>
      <article className="vault-feat">
        <div className="vault-feat__icon vault-feat__icon--azure">
          <LockIcon />
        </div>
        <h3>Secure vaulting</h3>
        <p>Cards stay in insured custody. Each token maps to a specific verified slab.</p>
      </article>
      <article className="vault-feat">
        <div className="vault-feat__icon vault-feat__icon--purple">
          <TradeIcon />
        </div>
        <h3>On-chain trading</h3>
        <p>Trade vaulted cards on Tokenable with atomic settlement — no shipping per sale.</p>
      </article>
    </section>
  );
}
