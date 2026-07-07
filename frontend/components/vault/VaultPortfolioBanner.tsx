"use client";

import { TkButton } from "@/components/ds";

export function VaultPortfolioBanner() {
  return (
    <aside className="vault-portfolio-banner" aria-label="Vaulted holdings">
      <div>
        <h2 className="vault-portfolio-banner__title">Already vaulted?</h2>
        <p className="vault-portfolio-banner__text">
          View minted tokens, listings, and trades in your Portfolio. Physical submission
          tracking dashboard ships in a later release.
        </p>
      </div>
      <TkButton variant="subtle" size="sm" href="/portfolio">
        Open Portfolio
      </TkButton>
    </aside>
  );
}
