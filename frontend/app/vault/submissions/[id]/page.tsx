"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { VaultShell } from "@/components/vault/VaultShell";
import { VaultDetailDesignView } from "@/components/vault/detail/VaultDetailDesignView";

function VaultSubmissionDetailBody() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const initialView =
    view === "completed" || view === "rejected" || view === "minting" ? view : "minting";

  return <VaultDetailDesignView initialView={initialView} />;
}

export default function VaultSubmissionDetailPage() {
  return (
    <VaultShell wide>
      <div className="vault-page__shell vault-page__shell--flow">
        <Suspense fallback={null}>
          <VaultSubmissionDetailBody />
        </Suspense>
      </div>
    </VaultShell>
  );
}
