"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { VaultShell } from "@/components/vault/VaultShell";
import { VaultDetailDesignView } from "@/components/vault/detail/VaultDetailDesignView";
import {
  CARRIER_LABELS,
  CARRIER_TRACK_URLS,
  readSellShipment,
  type SellCarrier,
} from "@/lib/sell/sellFlowDraft";
import { getVaultSubmission, type VaultSubmissionApi } from "@/lib/core/api/vault-submissions";
import {
  MOCK_SUBMISSION_ID,
  resolveDetailScenarioKey,
  type VaultDetailScenarioKey,
} from "@/lib/vault/vaultDetailScenarios";

function VaultSubmissionDetailBody() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const demo = searchParams.get("demo") === "1";
  const scenarioParam = searchParams.get("scenario");
  const view = searchParams.get("view");
  const paramId = typeof params.id === "string" ? decodeURIComponent(params.id) : MOCK_SUBMISSION_ID;

  const [apiSub, setApiSub] = useState<VaultSubmissionApi | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
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

  const local = useMemo(() => {
    if (typeof window === "undefined") return null;
    const s = readSellShipment();
    if (!s) return null;
    if (paramId === s.id || paramId === "latest") return s;
    return null;
  }, [paramId, loaded]);

  const submissionId = apiSub?.publicId ?? local?.id ?? paramId ?? MOCK_SUBMISSION_ID;

  const initialScenario: VaultDetailScenarioKey = apiSub
    ? apiSub.scenario
    : resolveDetailScenarioKey(scenarioParam, view);

  const livePackageCards = useMemo(() => {
    if (apiSub?.items?.length) {
      return apiSub.items.map((c, i) => ({
        id: i,
        name: c.name ?? c.cert,
        imageUrl: c.imageUrl ?? "",
        grade: c.grade ?? "PSA",
        cert: c.cert,
      }));
    }
    if (local?.cards?.length) {
      return local.cards
        .filter((c) => c.confirmed)
        .map((c, i) => ({
          id: i,
          name: c.name,
          imageUrl: c.img ?? "",
          grade: `PSA ${c.grade}`,
          cert: c.cert,
        }));
    }
    return undefined;
  }, [apiSub, local]);

  const tracking = useMemo(() => {
    if (apiSub?.carrier && apiSub.trackingNumber) {
      const carrier = apiSub.carrier as SellCarrier;
      return {
        label: `${CARRIER_LABELS[carrier] ?? apiSub.carrier} · ${apiSub.trackingNumber}`,
        url: `${CARRIER_TRACK_URLS[carrier] ?? ""}${encodeURIComponent(apiSub.trackingNumber)}`,
      };
    }
    if (local) {
      return {
        label: `${CARRIER_LABELS[local.carrier]} · ${local.trackingNumber}`,
        url: `${CARRIER_TRACK_URLS[local.carrier]}${encodeURIComponent(local.trackingNumber)}`,
      };
    }
    return null;
  }, [apiSub, local]);

  if (!loaded && !local) {
    return <div className="text-sm text-white/40 py-16 text-center">Loading submission…</div>;
  }

  return (
    <VaultDetailDesignView
      initialScenario={initialScenario}
      submissionId={submissionId}
      livePackageCards={livePackageCards}
      tracking={tracking}
      showScenarioSwitcher={demo}
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
