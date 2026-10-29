"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
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
  type VaultDetailScenarioKey,
  type VaultPackageCard,
  type VaultPackageCardStatus,
} from "@/lib/vault/vaultDetailScenarios";
import { vaultSubmissionItemDisplaySource } from "@/lib/vault/vaultSubmissionDisplay";

const PREVIEW_KEYS = new Set(["A", "B", "C", "D", "E", "F", "G", "H"]);

function previewCards(scenario: string): VaultPackageCard[] {
  const base = [
    {
      id: 0,
      name: "Charizard Holo · #4 · PSA 10",
      imageUrl: "",
      grade: "PSA 10",
      cert: "12345678",
      year: "1999",
      setName: "Base Set 1st Ed.",
      variant: "Holo",
    },
    {
      id: 1,
      name: "Pikachu Van Gogh · #085 · PSA 9",
      imageUrl: "",
      grade: "PSA 9",
      cert: "22938102",
      year: "2023",
      setName: "SVP Promo",
      variant: "Van Gogh",
    },
    {
      id: 2,
      name: "LeBron James · #111 · PSA 10",
      imageUrl: "",
      grade: "PSA 10",
      cert: "55501248",
      year: "2003",
      setName: "Topps Chrome",
      variant: "Rookie",
    },
  ];
  const statusFor = (i: number): VaultPackageCardStatus => {
    if (scenario === "D") return "reviewing";
    if (scenario === "E") return "approved";
    if (scenario === "F") return "rejected";
    if (scenario === "G") return "completed";
    if (scenario === "H") return i < 2 ? "completed" : "failed";
    return "reviewing";
  };
  const reasons = [
    "Holder shows signs of tampering",
    "Card doesn't match the cert number",
    "Doesn't meet PSA Vault terms",
  ];
  return base.map((c, i) => ({
    ...c,
    status: statusFor(i),
    reason: scenario === "F" ? reasons[i] : undefined,
    token: scenario === "G" || (scenario === "H" && i < 2) ? `#0${421 + i}` : undefined,
  }));
}

function VaultSubmissionDetailBody({
  previewScenario,
}: {
  previewScenario: Exclude<VaultDetailScenarioKey, "early"> | null;
}) {
  const t = useTranslations("VaultDetail");
  const params = useParams<{ id: string }>();
  const paramId = typeof params.id === "string" ? decodeURIComponent(params.id) : "";

  const [apiSub, setApiSub] = useState<VaultSubmissionApi | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (previewScenario) {
      setLoaded(true);
      return;
    }
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
  }, [paramId, previewScenario]);

  const displayByCert = useVaultSubmissionDisplayByCert(apiSub?.items ?? []);

  const livePackageCards = useMemo((): VaultPackageCard[] => {
    if (previewScenario) return previewCards(previewScenario);
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
  }, [apiSub, displayByCert, previewScenario]);

  const tracking = useMemo(() => {
    if (previewScenario === "C") {
      return { label: "FedEx · FX123456789", url: "#" };
    }
    if (!apiSub?.carrier || !apiSub.trackingNumber) return null;
    const carrier = apiSub.carrier as SellCarrier;
    return {
      label: `${CARRIER_LABELS[carrier] ?? apiSub.carrier} · ${apiSub.trackingNumber}`,
      url: `${CARRIER_TRACK_URLS[carrier] ?? ""}${encodeURIComponent(apiSub.trackingNumber)}`,
    };
  }, [apiSub, previewScenario]);

  if (previewScenario) {
    return (
      <VaultDetailDesignView
        initialScenario={previewScenario}
        submissionId="SUB-20260616-00421"
        livePackageCards={livePackageCards}
        tracking={tracking}
        submittedAt="2026-06-10T12:00:00.000Z"
      />
    );
  }

  if (!loaded) {
    return <div className="text-sm text-white/40 py-16 text-center">{t("loading")}</div>;
  }

  if (!apiSub) {
    return (
      <div className="text-sm text-white/50 py-16 text-center">
        {t("notFound")}
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

function VaultSubmissionDetailPageInner() {
  const searchParams = useSearchParams();
  const raw = (searchParams.get("preview") ?? "").toUpperCase();
  const previewScenario =
    process.env.NODE_ENV === "development" && PREVIEW_KEYS.has(raw)
      ? (raw as Exclude<VaultDetailScenarioKey, "early">)
      : null;

  return (
    <VaultShell wide className="vault-page--detail" ungated={previewScenario != null}>
      <Suspense fallback={null}>
        <VaultSubmissionDetailBody previewScenario={previewScenario} />
      </Suspense>
    </VaultShell>
  );
}

export default function VaultSubmissionDetailPage() {
  return (
    <Suspense fallback={null}>
      <VaultSubmissionDetailPageInner />
    </Suspense>
  );
}
