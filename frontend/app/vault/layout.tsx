"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppPageState } from "@/components/ui/AppPageState";
import { isVaultPathAccessible } from "@/lib/vault/vaultAccess";

export default function VaultLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (!isVaultPathAccessible(pathname)) {
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
