"use client";

import type { ReactNode } from "react";
import { AppPageState } from "@/components/ui/AppPageState";
import { VAULT_PUBLIC_ENABLED } from "@/lib/vault/vaultAccess";

export default function VaultLayout({ children }: { children: ReactNode }) {
  if (!VAULT_PUBLIC_ENABLED) {
    return (
      <div className="vault-page vault-page--hub">
        <div className="vault-page__shell vault-page__shell--wide">
          <AppPageState kind="vault_coming_soon" />
        </div>
      </div>
    );
  }

  return children;
}
