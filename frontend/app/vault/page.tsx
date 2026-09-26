"use client";

import { Suspense } from "react";
import { VaultShell } from "@/components/vault/VaultShell";
import { VaultHubView } from "@/components/vault/hub/VaultHubView";

export default function VaultPage() {
  return (
    <VaultShell wide className="vault-page--hub" ungated>
      <Suspense fallback={null}>
        <VaultHubView />
      </Suspense>
    </VaultShell>
  );
}
