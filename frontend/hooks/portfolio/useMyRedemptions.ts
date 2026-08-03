"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getMyRedemptions,
  type MyRedemptionRow,
} from "@/lib/core/api/rwa-redeem";
import { useAuthStore } from "@/store/authStore";

export function useMyRedemptions(tokenIds: number[]) {
  const user = useAuthStore((s) => s.user);
  const sortedKey = useMemo(
    () => [...tokenIds].sort((a, b) => a - b).join(","),
    [tokenIds],
  );

  const query = useQuery({
    queryKey: ["rwa", "redemptions", "mine", user?.id ?? null, sortedKey],
    queryFn: () => getMyRedemptions(tokenIds),
    enabled: Boolean(user?.id) && tokenIds.length > 0,
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

  const redemptionByTokenId = useMemo(() => {
    const m = new Map<number, MyRedemptionRow>();
    for (const row of query.data ?? []) {
      const id = Number(row.tokenId);
      if (!Number.isFinite(id)) continue;
      if (!m.has(id)) m.set(id, row);
    }
    return m;
  }, [query.data]);

  return { query, redeemStatusByTokenId, redemptionByTokenId };
}
