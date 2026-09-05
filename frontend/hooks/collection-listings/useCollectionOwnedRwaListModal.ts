"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  postRwaMetadataBatch,
  getActiveOrders,
  getRwaTokensByOwner,
  cancelOrder,
  rq,
  marketplaceRqPolicy,
  type Order,
  type OrderListItem,
  type RwaMetadata,
} from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";
import {
  invalidateAfterOrderCancel,
  invalidateAfterCollectionListing,
} from "@/lib/core/invalidation";
import { metadataMatchesCollectionKey } from "@/lib/marketplace/bucketKey";
import {
  buildRwaAssetDetailHeadlineParts,
  formatAssetDetailHeadlineText,
} from "@/lib/marketplace/assetDetailHeadline";
import { TOKENABLE_RWA_DISPLAY_NAME } from "@/constants/contracts";

export type OwnedInCollection = {
  tokenId: number;
  tokenURI: string | null;
  metadata: RwaMetadata | null;
  imageUrl: string | null;
};

export function useCollectionOwnedRwaListModal({
  open,
  onClose,
  collectionKey,
}: {
  open: boolean;
  onClose: () => void;
  collectionKey: string;
}) {
  const { address: effectiveAddr } = useAccount();
  const queryClient = useQueryClient();

  const [listingTokenId, setListingTokenId] = useState<number | null>(null);
  const [cancellingHash, setCancellingHash] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setListingTokenId(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const { data: rows, isLoading } = useQuery({
    queryKey: rq.collectionOwnedRwa(effectiveAddr ?? "", collectionKey),
    queryFn: async (): Promise<OwnedInCollection[]> => {
      if (!effectiveAddr) return [];
      const ids = await getRwaTokensByOwner(effectiveAddr);
      if (ids.length === 0) return [];

      const { items } = await postRwaMetadataBatch({ tokenIds: ids });
      const enriched: OwnedInCollection[] = [];
      for (const row of items) {
        const metaObj = row.metadata as Record<string, unknown> | null;
        const match = await metadataMatchesCollectionKey(metaObj, collectionKey);
        if (!match) continue;
        enriched.push({
          tokenId: row.tokenId,
          tokenURI: row.tokenURI ?? null,
          metadata: row.metadata,
          imageUrl: row.imageUrl ?? null,
        });
      }

      return enriched.sort((a, b) => b.tokenId - a.tokenId);
    },
    enabled: open && !!effectiveAddr && !!collectionKey,
    staleTime: 30_000,
  });

  const { data: orders } = useQuery({
    queryKey: rq.ordersActive(activeRqChainId()),
    queryFn: getActiveOrders,
    enabled: open && !!effectiveAddr,
    refetchInterval: marketplaceRqPolicy.ordersRefetchMs,
    staleTime: marketplaceRqPolicy.ordersStaleMs,
  });

  const activeByToken = useMemo(() => {
    const m = new Map<number, OrderListItem>();
    for (const o of orders ?? []) {
      if (o.status === "active" && o.side === "ask") m.set(Number(o.tokenId), o);
    }
    return m;
  }, [orders]);

  const listingAssetTitle = useMemo(() => {
    if (listingTokenId == null) return null;
    const fallback = `${TOKENABLE_RWA_DISPLAY_NAME} #${listingTokenId}`;
    const asset = rows?.find((a) => a.tokenId === listingTokenId);
    if (!asset?.metadata) return fallback;
    return formatAssetDetailHeadlineText(
      buildRwaAssetDetailHeadlineParts(asset.metadata, fallback),
    );
  }, [listingTokenId, rows]);

  const listingAsk =
    listingTokenId != null ? activeByToken.get(listingTokenId) : undefined;

  async function handleCancel(order: OrderListItem) {
    if (!effectiveAddr) return;
    setCancellingHash(order.orderHash);
    try {
      await cancelOrder(order.orderHash, effectiveAddr);
      await invalidateAfterOrderCancel(queryClient, collectionKey);
    } finally {
      setCancellingHash(null);
    }
  }

  function invalidateAfterList() {
    void invalidateAfterCollectionListing(queryClient, collectionKey, effectiveAddr ?? "");
  }

  return {
    effectiveAddr,
    rows,
    isLoading,
    activeByToken,
    listingTokenId,
    setListingTokenId,
    listingAssetTitle,
    listingAsk,
    cancellingHash,
    handleCancel,
    invalidateAfterList,
  };
}
