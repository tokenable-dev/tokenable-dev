"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { postRwaMetadataBatch, rq, marketplaceRqPolicy, type Order } from "@/lib/core";
import {
  askPriceMicros,
  formatCriteriaBidUsdc6,
  pickLowestActiveAskCandidates,
} from "@/lib/seaport/criteria/collectionCriteriaBidAsk";

export function useCriteriaBidFloorAsks(input: {
  collectionKey: string;
  activeAsks: Order[];
  presetPriceFromBook?: string | null;
  /** When set, pre-fills price from an existing bid (change-price flow). */
  bidToReplace?: Order | null;
}) {
  const { collectionKey, activeAsks, presetPriceFromBook, bidToReplace } = input;

  const [price, setPrice] = useState("");
  const priceTouchedRef = useRef(false);
  const [selectedFloorAskHash, setSelectedFloorAskHash] = useState<string | null>(null);
  const [showAskChooserModal, setShowAskChooserModal] = useState(false);

  const lowestAskCandidates = useMemo(
    () => pickLowestActiveAskCandidates(activeAsks),
    [activeAsks],
  );

  const lowestAsk = useMemo(() => {
    if (lowestAskCandidates.length === 0) return null;
    if (!selectedFloorAskHash) return lowestAskCandidates[0]!;
    return (
      lowestAskCandidates.find((o) => o.orderHash === selectedFloorAskHash) ??
      lowestAskCandidates[0]!
    );
  }, [lowestAskCandidates, selectedFloorAskHash]);

  useEffect(() => {
    if (lowestAskCandidates.length < 2) {
      setSelectedFloorAskHash(null);
      return;
    }
    const hashes = lowestAskCandidates.map((o) => o.orderHash);
    setSelectedFloorAskHash((prev) => (prev && hashes.includes(prev) ? prev : hashes[0]!));
  }, [lowestAskCandidates]);

  const floorAskTokenIds = useMemo(
    () => lowestAskCandidates.map((o) => Number(o.tokenId)).filter((id) => Number.isFinite(id)),
    [lowestAskCandidates],
  );

  const floorAskMetadataSig = useMemo(
    () => [...floorAskTokenIds].sort((a, b) => a - b).join(","),
    [floorAskTokenIds],
  );

  const { data: floorAskMetaPack } = useQuery({
    queryKey: rq.floorAskMetadata(collectionKey, floorAskMetadataSig),
    queryFn: () => postRwaMetadataBatch({ tokenIds: floorAskTokenIds }),
    enabled: showAskChooserModal && floorAskTokenIds.length > 0,
    staleTime: marketplaceRqPolicy.metadataDetailStaleMs,
  });

  const floorMetaByTokenId = useMemo(() => {
    const m = new Map<number, { name?: string; imageUrl: string | null }>();
    for (const it of floorAskMetaPack?.items ?? []) {
      const name =
        typeof it.metadata?.name === "string" && it.metadata.name.trim().length > 0
          ? it.metadata.name.trim()
          : undefined;
      m.set(it.tokenId, { name, imageUrl: it.imageUrl ?? null });
    }
    return m;
  }, [floorAskMetaPack]);

  const lowestAskUsdc = lowestAsk
    ? formatCriteriaBidUsdc6(String(askPriceMicros(lowestAsk)))
    : null;

  useEffect(() => {
    if (presetPriceFromBook != null && presetPriceFromBook.trim() !== "") {
      setPrice(presetPriceFromBook);
      priceTouchedRef.current = false;
    }
  }, [presetPriceFromBook]);

  useEffect(() => {
    if (bidToReplace == null || presetPriceFromBook != null) return;
    try {
      const offer0 = bidToReplace.parameters?.offer?.[0];
      const amt = offer0?.startAmount ?? bidToReplace.considerationAmount;
      const s = formatUnits(BigInt(amt), 6);
      const n = parseFloat(s);
      setPrice(Number.isFinite(n) ? String(n) : s);
      priceTouchedRef.current = false;
    } catch {
      /* ignore */
    }
  }, [bidToReplace?.orderHash, presetPriceFromBook]);

  useEffect(() => {
    if (priceTouchedRef.current || !lowestAsk || presetPriceFromBook != null || bidToReplace != null)
      return;
    try {
      const s = formatUnits(askPriceMicros(lowestAsk), 6);
      const n = parseFloat(s);
      setPrice(Number.isFinite(n) ? String(n) : s);
    } catch {
      /* ignore */
    }
  }, [lowestAsk, presetPriceFromBook]);

  const priceInUnits = useMemo(() => {
    try {
      const trimmed = price.trim();
      if (!trimmed) return null;
      const n = parseFloat(trimmed);
      if (!Number.isFinite(n) || n <= 0) return null;
      return parseUnits(trimmed, 6);
    } catch {
      return null;
    }
  }, [price]);

  const crossesBook = useMemo(() => {
    if (!lowestAsk || priceInUnits == null) return false;
    return priceInUnits >= askPriceMicros(lowestAsk);
  }, [lowestAsk, priceInUnits]);

  const enteredAboveBestAsk = useMemo(() => {
    if (!lowestAsk || priceInUnits == null || !crossesBook) return false;
    return priceInUnits > askPriceMicros(lowestAsk);
  }, [lowestAsk, priceInUnits, crossesBook]);

  const enteredUsdcLabel = useMemo(() => {
    if (priceInUnits == null) return null;
    try {
      const n = Number(formatUnits(priceInUnits, 6));
      if (!Number.isFinite(n)) return null;
      return n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      return null;
    }
  }, [priceInUnits]);

  const priceOk = priceInUnits != null;

  return {
    price,
    setPrice,
    priceTouchedRef,
    selectedFloorAskHash,
    setSelectedFloorAskHash,
    showAskChooserModal,
    setShowAskChooserModal,
    lowestAsk,
    lowestAskCandidates,
    lowestAskUsdc,
    floorMetaByTokenId,
    priceInUnits,
    crossesBook,
    enteredAboveBestAsk,
    enteredUsdcLabel,
    priceOk,
  };
}
