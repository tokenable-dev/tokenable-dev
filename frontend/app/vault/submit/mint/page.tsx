"use client";

import { VaultShell } from "@/components/vault/VaultShell";
import { MintForm } from "@/components/vault/mint-form";

/** Legacy functional mint flow — design screens live at `/vault/submit`. */
export default function VaultSubmitMintPage() {
  return (
    <VaultShell>
      <MintForm />
    </VaultShell>
  );
}
