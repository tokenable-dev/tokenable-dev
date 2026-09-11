"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getMyRedemptions,
  type MyRedemptionRow,
} from "@/lib/core/api/rwa-redeem";
import { isRedeemInFlight } from "@/lib/portfolio/redeemDraft";
import { useAuthStore } from "@/store/authStore";
import { useAppChain } from "@/providers/AppChainProvider";

/**
 * Open redemptions for the signed-in user on the **active app chain** (including
 * tokens already transferred to custody and therefore missing from wallet holdings).
 */
export function useMyRedemptions(enabled = true) {
  const user = useAuthStore((s) => s.user);
  const { chainId } = useAppChain();

  const query = useQuery({
    queryKey: ["rwa", "redemptions", "mine", user?.id ?? null, chainId],
    queryFn: () => getMyRedemptions(chainId),
    enabled: Boolean(user?.id) && enabled,
    staleTime: 30_000,
  });

  const redeemStatusByTokenId = useMemo(() => {
    const m = new Map<number, string>();
    for (const row of query.data ?? []) {
      const id = Number(row.tokenId);
      if (!Number.isFinite(id)) continue;
      // Prefer the most recent open status already ordered DESC from API.
      if (!m.has(id)) m.set(id, row.status);
    }
    return m;
  }, [query.data]);

  const redeemTrackingByTokenId = useMemo(() => {
    const m = new Map<number, string>();
    for (const row of query.data ?? []) {
      const id = Number(row.tokenId);
      if (!Number.isFinite(id)) continue;
      const t = row.trackingNumber?.trim();
      if (t && !m.has(id)) m.set(id, t);
    }
    return m;
  }, [query.data]);

  const redeemCarrierDeliveredByTokenId = useMemo(() => {
    const m = new Map<number, string>();
    for (const row of query.data ?? []) {
      const id = Number(row.tokenId);
      if (!Number.isFinite(id)) continue;
      const d = row.carrierDeliveredAt?.trim();
      if (d && !m.has(id)) m.set(id, d);
    }
    return m;
  }, [query.data]);

  const redeemPaymentBatchByTokenId = useMemo(() => {
    const m = new Map<number, string>();
    for (const row of query.data ?? []) {
      const id = Number(row.tokenId);
      if (!Number.isFinite(id)) continue;
      const b = row.paymentBatchId?.trim();
      if (b && !m.has(id)) m.set(id, b);
    }
    return m;
  }, [query.data]);

  const redemptionByTokenId = useMemo(() => {
    const m = new Map<number, MyRedemptionRow>();
    for (const row of query.data ?? []) {
      const id = Number(row.tokenId);
      if (!Number.isFinite(id)) continue;
      if (!m.has(id)) m.set(id, row);
    }
    return m;
  }, [query.data]);

  /** In-flight redemptions (preparing / custody / transit) — for phantom holdings. */
  const inFlightRows = useMemo(() => {
    const seen = new Set<number>();
    const out: MyRedemptionRow[] = [];
    for (const row of query.data ?? []) {
      const id = Number(row.tokenId);
      if (!Number.isFinite(id) || seen.has(id)) continue;
      if (!isRedeemInFlight(row.status)) continue;
      seen.add(id);
      out.push(row);
    }
    return out;
  }, [query.data]);

  /** Completed redemptions — Redeem tab history (still listed by /mine). */
  const completedRows = useMemo(() => {
    const seen = new Set<number>();
    const out: MyRedemptionRow[] = [];
    for (const row of query.data ?? []) {
      const id = Number(row.tokenId);
      if (!Number.isFinite(id) || seen.has(id)) continue;
      if (row.status !== "completed") continue;
      seen.add(id);
      out.push(row);
    }
    return out;
  }, [query.data]);

  return {
    query,
    redeemStatusByTokenId,
    redeemTrackingByTokenId,
    redeemCarrierDeliveredByTokenId,
    redeemPaymentBatchByTokenId,
    redemptionByTokenId,
    inFlightRows,
    completedRows,
  };
}
