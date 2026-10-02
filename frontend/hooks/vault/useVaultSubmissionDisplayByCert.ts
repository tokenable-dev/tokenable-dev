"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { analyzePsaByCertNumber } from "@/lib/core/api/psa";
import type { VaultSubmissionApiItem } from "@/lib/core/api/vault-submissions";
import {
  sellDraftCardFieldsFromPsaAnalyze,
  type SellCardDisplaySource,
} from "@/lib/sell/sellFlowDraft";
import {
  needsPsaDisplayEnrichment,
  vaultSubmissionItemDisplaySource,
} from "@/lib/vault/vaultSubmissionDisplay";

/** PSA cert lookup for hub rows missing year/set/number (legacy submissions). */
export function useVaultSubmissionDisplayByCert(
  items: VaultSubmissionApiItem[],
): Map<string, SellCardDisplaySource> {
  const certsNeeding = useMemo(() => {
    const out = new Set<string>();
    for (const item of items) {
      if (needsPsaDisplayEnrichment(vaultSubmissionItemDisplaySource(item))) {
        out.add(item.cert);
      }
    }
    return [...out];
  }, [items]);

  const queries = useQueries({
    queries: certsNeeding.map((cert) => ({
      queryKey: ["psa", "analyze-by-cert", cert] as const,
      queryFn: () => analyzePsaByCertNumber(cert),
      staleTime: 86_400_000,
      enabled: Boolean(cert),
    })),
  });

  return useMemo(() => {
    const map = new Map<string, SellCardDisplaySource>();
    certsNeeding.forEach((cert, i) => {
      const r = queries[i]?.data;
      if (!r) return;
      const fields = sellDraftCardFieldsFromPsaAnalyze(r);
      const stored = items.find((it) => it.cert === cert);
      map.set(cert, {
        cert,
        name: fields.name,
        cardNumber: fields.cardNumber,
        year: fields.year,
        setName: fields.setName,
        language: fields.language,
        variant: fields.variant,
        grade: r.psa.gradeScore ?? stored?.grade ?? null,
      });
    });
    return map;
  }, [certsNeeding, queries, items]);
}
