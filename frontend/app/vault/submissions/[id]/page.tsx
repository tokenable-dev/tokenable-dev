"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { VaultShell } from "@/components/vault/VaultShell";
import { VaultDetailDesignView } from "@/components/vault/detail/VaultDetailDesignView";
import { useVaultSubmissionDisplayByCert } from "@/hooks/vault/useVaultSubmissionDisplayByCert";
import {
  CARRIER_LABELS,
  CARRIER_TRACK_URLS,
  type SellCarrier,
} from "@/lib/sell/sellFlowDraft";
import { getVaultSubmission, type VaultSubmissionApi } from "@/lib/core/api/vault-submissions";
import {
  mapApiItemStatus,
  resolveDetailScenarioKey,
  type VaultPackageCard,
} from "@/lib/vault/vaultDetailScenarios";
import { vaultSubmissionItemDisplaySource } from "@/lib/vault/vaultSubmissionDisplay";

function VaultSubmissionDetailBody() {
  const params = useParams<{ id: string }>();
  const paramId = typeof params.id === "string" ? decodeURIComponent(params.id) : "";

  const [apiSub, setApiSub] = useState<VaultSubmissionApi | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!paramId) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const row = await getVaultSubmission(paramId);
        if (!cancelled) setApiSub(row);
      } catch {
        if (!cancelled) setApiSub(null);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paramId]);

  const displayByCert = useVaultSubmissionDisplayByCert(apiSub?.items ?? []);

  const livePackageCards = useMemo((): VaultPackageCard[] => {
    if (!apiSub?.items?.length) return [];
    return apiSub.items.map((c, i) => {
      const display = vaultSubmissionItemDisplaySource(
        c,
        displayByCert.get(c.cert),
      );
      return {
        id: i,
        name: display.name ?? c.cert,
        imageUrl: c.imageUrl ?? "",
        grade: c.grade ?? "PSA",
        cert: c.cert,
        cardNumber: display.cardNumber,
        year: display.year,
        setName: display.setName,
        language: display.language,
        variant: display.variant,
        status: mapApiItemStatus(c.status),
        reason: c.rejectionReason ?? undefined,
        token: c.vaultCycleId ? `#${c.vaultCycleId.slice(0, 6)}` : undefined,
      };
    });
  }, [apiSub, displayByCert]);

  const tracking = useMemo(() => {
    if (!apiSub?.carrier || !apiSub.trackingNumber) return null;
    const carrier = apiSub.carrier as SellCarrier;
    return {
      label: `${CARRIER_LABELS[carrier] ?? apiSub.carrier} · ${apiSub.trackingNumber}`,
      url: `${CARRIER_TRACK_URLS[carrier] ?? ""}${encodeURIComponent(apiSub.trackingNumber)}`,
    };
  }, [apiSub]);

  if (!loaded) {
    return <div className="text-sm text-white/40 py-16 text-center">Loading submission…</div>;
  }

  if (!apiSub) {
    return (
      <div className="text-sm text-white/50 py-16 text-center">
        Submission not found.
      </div>
    );
  }

  return (
    <VaultDetailDesignView
      initialScenario={resolveDetailScenarioKey(apiSub.scenario)}
      submissionId={apiSub.publicId}
      livePackageCards={livePackageCards}
      tracking={tracking}
      submittedAt={apiSub.createdAt}
    />
  );
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
