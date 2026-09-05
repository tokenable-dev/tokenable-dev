"use client";

import { VaultShell } from "@/components/vault/VaultShell";
import { MintForm } from "@/components/vault/mint-form";

/** Personal / internal mint — PSA verify → IPFS → backend mint. */
export default function VaultSubmitMintPage() {
  return (
    <VaultShell>
      <MintForm />
    </VaultShell>
  );
}
