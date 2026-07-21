"use client";

import { VaultShell } from "@/components/vault/VaultShell";
import { MintForm } from "@/components/vault/mint-form";

/** Real vault deposit mint — PSA verify → IPFS → backend mint. */
export default function VaultSubmitPage() {
  return (
    <VaultShell>
      <MintForm />
    </VaultShell>
  );
}
