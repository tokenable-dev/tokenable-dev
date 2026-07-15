"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { VaultShell } from "@/components/vault/VaultShell";
import { VaultDetailDesignView } from "@/components/vault/detail/VaultDetailDesignView";
import { resolveDetailScenarioKey } from "@/lib/vault/vaultDetailScenarios";

function VaultSubmissionDetailBody() {
  const searchParams = useSearchParams();
  const scenario = searchParams.get("scenario");
  const view = searchParams.get("view");
  const initialScenario = resolveDetailScenarioKey(scenario, view);

  return <VaultDetailDesignView initialScenario={initialScenario} />;
}

export default function VaultSubmissionDetailPage() {
  return (
    <VaultShell wide className="vault-page--detail">
      <Suspense fallback={null}>
        <VaultSubmissionDetailBody />
      </Suspense>
    </VaultShell>
  );
}
