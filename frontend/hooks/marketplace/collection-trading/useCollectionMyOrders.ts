"use client";

import { useMemo, useState } from "react";
import { cancelOrder, type Order } from "@/lib/core";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteria/criteriaMatch";
import { isCollectionBidMerkleStale } from "@/lib/seaport/criteria/collectionCriteriaRoot";
import { useCollectionMerkleRootHex } from "@/lib/seaport/criteria/useCollectionMerkleRootHex";

function isAskRow(o: Order): boolean {
  return String(o.side ?? "ask").toLowerCase() !== "bid";
}

export function useCollectionMyOrders({
  asks,
  collectionBids,
  address,
  onInvalidate,
  collectionKey,
}: {
  asks: Order[];
  collectionBids: Order[];
  address?: string | null;
  onInvalidate?: () => void;
  collectionKey?: string;
}) {
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [bidToChange, setBidToChange] = useState<Order | null>(null);
  const { data: currentMerkleRootHex } = useCollectionMerkleRootHex(collectionKey);

  const addr = address?.toLowerCase() ?? "";

  const myListings = useMemo(
    () =>
      asks.filter(
        (o) =>
          addr &&
          o.offerer.toLowerCase() === addr &&
          o.status === "active" &&
          isAskRow(o),
      ),
    [asks, addr],
  );

  const myBids = useMemo(
    () =>
      collectionBids.filter(
        (o) =>
          addr &&
          o.offerer.toLowerCase() === addr &&
          o.status === "active" &&
          isCriteriaCollectionBid(o),
      ),
    [collectionBids, addr],
  );

  const total = myListings.length + myBids.length;

  const isBidStale = (o: Order) => isCollectionBidMerkleStale(o, currentMerkleRootHex);

  async function handleCancel(orderHash: string) {
    if (!address) return;
    setCancelling(orderHash);
    try {
      await cancelOrder(orderHash, address);
      onInvalidate?.();
    } finally {
      setCancelling(null);
    }
  }

  return {
    addr,
    myListings,
    myBids,
    total,
    cancelling,
    handleCancel,
    isBidStale,
    bidToChange,
    setBidToChange,
  };
}
