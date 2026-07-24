"use client";

import Link from "next/link";
import { TkButton } from "@/components/ds";
import { VaultBreadcrumb } from "@/components/vault/VaultBreadcrumb";

/** List-for-sale UI — no mock token selected until live vault inventory is wired. */
export function VaultListDesignView() {
  return (
    <>
      <VaultBreadcrumb
        items={[
          { label: "My Vault", href: "/vault" },
          { label: "List for Sale" },
        ]}
      />

      <span className="vault-list-eyebrow">List for Sale</span>
      <h1 className="vault-list-title">List Your Card</h1>

      <div className="vault-card-box mb-8 p-6 text-center">
        <p className="mb-2 text-base text-white/80">No vaulted token selected</p>
        <p className="mb-6 text-sm text-white/40">
          Listing will be available once you have a minted token in your vault.
        </p>
        <Link href="/vault" className="inline-flex">
          <TkButton decorative variant="primary" size="md" className="h-12 px-6 justify-center text-sm">
            Back to Vault →
          </TkButton>
        </Link>
      </div>
    </>
  );
}
