"use client";

import Link from "next/link";

/** Sell hub header — Vault-Dashboard-Active.html (design system-22). */
export function VaultHubHeader({ showSubmitCta = true }: { showSubmitCta?: boolean }) {
  return (
    <div className="vault-hub-header">
      <div className="vault-hub-header__copy">
        <span className="vault-hub-header__eyebrow">Sell</span>
        <h1 className="vault-hub-header__title">Vaulting</h1>
        <p className="vault-hub-header__sub">
          Cards being verified and vaulted before they go live.
        </p>
      </div>
      {showSubmitCta ? (
        <Link href="/sell/flow" className="vault-hub-header__cta tk-btn tk-btn--primary">
          + Sell a Card
        </Link>
      ) : null}
    </div>
  );
}
