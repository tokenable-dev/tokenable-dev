"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import type { useRouter } from "next/navigation";
import type { TradeCelebrationKind } from "@/lib/marketplace/marketplaceTradingTypes";
import { useSellAccessGate } from "@/hooks/auth/useSellAccessGate";

export function useRwaDetailListFlow(input: {
  tokenId: number;
  tokenIdOk: boolean;
  searchParams: ReadonlyURLSearchParams;
  router: ReturnType<typeof useRouter>;
  isOwner: boolean;
  isConnected: boolean;
  ownerLoading: boolean;
}) {
  const { tokenId, tokenIdOk, searchParams, router, isOwner, isConnected, ownerLoading } =
    input;

  const listReturnTo = `/marketplace/${tokenId}?list=1`;
  const { runSellAccessGate } = useSellAccessGate(listReturnTo);

  const [listModalOpen, setListModalOpen] = useState(false);
  const [listModalInitialPrice, setListModalInitialPrice] = useState<string | null>(null);
  const [tradeCelebration, setTradeCelebration] = useState<TradeCelebrationKind | null>(
    null,
  );

  const openListModal = useCallback(
    (initialPriceUsdc: string | null = null) => {
      runSellAccessGate(() => {
        setListModalInitialPrice(initialPriceUsdc);
        setListModalOpen(true);
      });
    },
    [runSellAccessGate],
  );

  const closeListModal = useCallback(() => {
    setListModalOpen(false);
    setListModalInitialPrice(null);
  }, []);

  /** Collection card entry with `?list=1` — auto-open list modal for owner, then strip query. */
  useEffect(() => {
    if (searchParams.get("list") !== "1") return;
    if (!tokenIdOk || ownerLoading) return;
    if (isOwner && isConnected) {
      runSellAccessGate(() => {
        setListModalInitialPrice(null);
        setListModalOpen(true);
      });
    }
    const fc = searchParams.get("fromCollection");
    const next =
      fc && fc.trim()
        ? `/marketplace/${tokenId}?fromCollection=${encodeURIComponent(fc.trim())}`
        : `/marketplace/${tokenId}`;
    router.replace(next, { scroll: false });
  }, [
    searchParams,
    tokenIdOk,
    ownerLoading,
    isOwner,
    isConnected,
    tokenId,
    router,
    runSellAccessGate,
  ]);

  return {
    listModalOpen,
    listModalInitialPrice,
    tradeCelebration,
    setTradeCelebration,
    openListModal,
    closeListModal,
  };
}
