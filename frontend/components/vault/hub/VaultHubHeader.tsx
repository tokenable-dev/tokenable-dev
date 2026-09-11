"use client";

import Link from "next/link";

const DEFAULT_TITLE = "Track your vaulting progress";

/** Sell hub header — Vault-Dashboard-Active.html (design system-22). */
export function VaultHubHeader({
  showSubmitCta = true,
  title = DEFAULT_TITLE,
}: {
  showSubmitCta?: boolean;
  title?: string;
}) {
  return (
    <div className="vault-hub-header">
      <div className="vault-hub-header__copy">
        <span className="vault-hub-header__eyebrow">Selling</span>
        <h1 className="vault-hub-header__title">{title}</h1>
      </div>
      {showSubmitCta ? (
        <Link href="/sell/flow" className="vault-hub-header__cta tk-btn tk-btn--primary">
          + Sell a Card
        </Link>
      ) : null}
    </div>
  );
}
