"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  postRwaMetadataBatch,
  getActiveOrders,
  getRwaTokensByOwner,
  cancelOrder,
  type Order,
  type OrderListItem,
  type RwaMetadata,
} from "@/lib/core";
import { metadataMatchesCollectionKey } from "@/lib/marketplace/bucketKey";
import {
  buildRwaAssetDetailHeadlineParts,
  formatAssetDetailHeadlineText,
} from "@/lib/marketplace/assetDetailHeadline";
import { ListRwaModal } from "@/components/marketplace/ListRwaModal";
import { TOKENABLE_RWA_DISPLAY_NAME } from "@/constants/contracts";
import { rq, marketplaceRqPolicy } from "@/lib/core";

interface OwnedInCollection {
  tokenId: number;
  tokenURI: string | null;
  metadata: RwaMetadata | null;
  imageUrl: string | null;
}

export function CollectionOwnedRwaListModal({
  open,
  onClose,
  collectionKey,
  collectionLabel,
  collectionBids = [],
  listPricePresetUsdc,
  preferredBidOrderHash,
  onSaleCelebration,
}: {
  open: boolean;
  onClose: () => void;
  collectionKey: string;
  collectionLabel: string;
  /** Active collection criteria bids — used to auto `matchAdvancedOrders` after listing when price crosses a bid. */
  collectionBids?: Order[];
  /** When user clicked a bid row on the book, prefill this USDC price in the list modal (e.g. undercut a high ask to hit the bid). */
  listPricePresetUsdc?: string | null;
  /** Order hash of the bid row selected on the book — tried first for instant match. */
  preferredBidOrderHash?: string | null;
  /** Listing matched a bid immediately — parent may show a celebration overlay. */
  onSaleCelebration?: () => void;
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

  /** 모바일에서 뒤 페이지 스크롤 방지 + iOS 바운스 완화 */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["collection-owned-rwa", effectiveAddr, collectionKey, open],
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
    queryKey: rq.ordersActive(),
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

  async function handleCancel(order: OrderListItem) {
    if (!effectiveAddr) return;
    setCancellingHash(order.orderHash);
    try {
      await cancelOrder(order.orderHash, effectiveAddr);
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-collection", collectionKey] });
    } finally {
      setCancellingHash(null);
    }
  }

  if (!open) return null;

  const listingAsk =
    listingTokenId != null ? activeByToken.get(listingTokenId) : undefined;

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="collection-sell-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative z-[81] w-full max-w-2xl sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[min(94dvh,900px)] sm:max-h-[min(96vh,960px)] flex flex-col rounded-t-2xl sm:rounded-2xl border border-gray-800 bg-[#0b0e11] shadow-2xl overflow-hidden pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-0"
      >
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-5 border-b border-gray-800/90 shrink-0">
          <div className="min-w-0">
            <h2 id="collection-sell-modal-title" className="text-xl sm:text-2xl font-bold text-white truncate">
              List in this collection
            </h2>
            <p className="text-sm text-gray-500 mt-1.5 line-clamp-2">{collectionLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-3 py-2 text-base text-gray-400 hover:text-white hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5">
          {!effectiveAddr ? (
            <p className="text-sm text-gray-500 text-center py-8">Connect your wallet to see assets.</p>
          ) : isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="aspect-[4/5] rounded-xl bg-gray-800/60 animate-pulse" />
              ))}
            </div>
          ) : !rows?.length ? (
            <div className="text-center py-10 space-y-2">
              <p className="text-sm text-gray-400">
                No owned RWAs match this collection&apos;s card bucket.
              </p>
              <p className="text-xs text-gray-600 max-w-sm mx-auto leading-relaxed">
                Collections are derived from graded metadata (PSA / Cardhedger fields). If you expected a
                match, check that this asset was minted with the same card + grade signature.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5">
              {rows.map((asset) => {
                const imageUrl = asset.imageUrl;
                const order = activeByToken.get(asset.tokenId);
                const listed = !!order;

                return (
                  <div
                    key={asset.tokenId}
                    className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden flex flex-col shadow-lg"
                  >
                    <div className="aspect-square bg-gray-800 relative p-3 sm:p-3.5">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={asset.metadata?.name ?? `#${asset.tokenId}`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
                          No image
                        </div>
                      )}
                      <div className="absolute top-2 left-2 bg-black/60 text-[11px] sm:text-xs text-gray-300 px-2 py-1 rounded-full">
                        #{asset.tokenId}
                      </div>
                      {listed && (
                        <div className="absolute top-2 right-2 bg-slate-600/90 text-[11px] sm:text-xs text-slate-100 px-2 py-1 rounded-full">
                          Listed
                        </div>
                      )}
                    </div>
                    <div className="p-3 sm:p-4 flex flex-col flex-1 min-h-0">
                      <p className="text-sm font-semibold text-white truncate leading-snug">
                        {asset.metadata?.name ?? `${TOKENABLE_RWA_DISPLAY_NAME} #${asset.tokenId}`}
                      </p>
                      <div className="mt-auto pt-3">
                        {listed && order ? (
                          <>
                            <p className="text-xs text-mint/90 mb-2 font-medium tabular-nums">
                              {(Number(order.price) / 1_000_000).toLocaleString()} USDC
                            </p>
                            <button
                              type="button"
                              onClick={() => setListingTokenId(asset.tokenId)}
                              className="w-full py-2.5 text-xs font-semibold bg-mint/10 hover:bg-mint/15 text-mint rounded-xl border border-mint-deep/35 mb-2"
                            >
                              Change price
                            </button>
                            <button
                              type="button"
                              disabled={cancellingHash === order.orderHash}
                              onClick={() => void handleCancel(order)}
                              className="w-full py-2.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-600/50 disabled:opacity-40"
                            >
                              {cancellingHash === order.orderHash ? "…" : "Cancel listing"}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setListingTokenId(asset.tokenId)}
                            className="w-full py-2.5 text-xs font-semibold bg-mint/10 hover:bg-mint/15 text-mint rounded-xl border border-mint-deep/35"
                          >
                            List for sale
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {listingTokenId != null && (
        <ListRwaModal
          tokenId={listingTokenId}
          assetTitle={listingAssetTitle}
          collectionKey={collectionKey}
          collectionBids={collectionBids}
          preferredBidOrderHash={preferredBidOrderHash ?? undefined}
          existingAskOrder={undefined}
          existingAskOrderHash={
            listingAsk?.side === "ask" && listingAsk.status === "active"
              ? listingAsk.orderHash
              : undefined
          }
          initialPriceUsdc={listPricePresetUsdc ?? undefined}
          onMatchedSale={() => onSaleCelebration?.()}
          onClose={() => setListingTokenId(null)}
          onListed={() => {
            setListingTokenId(null);
            void queryClient.invalidateQueries({ queryKey: ["orders"] });
            void queryClient.invalidateQueries({ queryKey: ["marketplace-collection", collectionKey] });
            void queryClient.invalidateQueries({ queryKey: ["merkle-set", collectionKey] });
            void queryClient.invalidateQueries({
              queryKey: ["collection-owned-rwa", effectiveAddr, collectionKey],
            });
            onClose();
          }}
        />
      )}
    </div>
  );
}
