"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  fetchIpfsMetadata,
  getActiveOrders,
  getRwaTokenURI,
  getRwaTokensByOwner,
  resolveIpfsImage,
  cancelOrder,
  type Order,
  type RwaMetadata,
} from "@/lib/api";
import { metadataMatchesCollectionKey } from "@/lib/marketplace/bucketKey";
import { ListRwaModal } from "@/components/marketplace/ListRwaModal";
import { TOKENABLE_RWA_DISPLAY_NAME } from "@/constants/contracts";

interface OwnedInCollection {
  tokenId: number;
  tokenURI: string;
  metadata: RwaMetadata | null;
}

export function CollectionOwnedRwaListModal({
  open,
  onClose,
  collectionKey,
  collectionLabel,
  collectionBids = [],
  listPricePresetUsdc,
}: {
  open: boolean;
  onClose: () => void;
  collectionKey: string;
  collectionLabel: string;
  /** Active collection criteria bids — used to auto `matchAdvancedOrders` after listing when price crosses a bid. */
  collectionBids?: Order[];
  /** When user clicked a bid row on the book, prefill this USDC price in the list modal (e.g. undercut a high ask to hit the bid). */
  listPricePresetUsdc?: string | null;
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

      const enriched = await Promise.all(
        ids.map(async (tokenId): Promise<OwnedInCollection | null> => {
          try {
            const tokenURI = await getRwaTokenURI(tokenId);
            const metadata = tokenURI
              ? await fetchIpfsMetadata(tokenURI).catch(() => null)
              : null;
            const metaObj = metadata as Record<string, unknown> | null;
            const match = await metadataMatchesCollectionKey(metaObj, collectionKey);
            if (!match) return null;
            return { tokenId, tokenURI, metadata };
          } catch {
            return null;
          }
        })
      );

      return enriched.filter((x): x is OwnedInCollection => x != null).sort((a, b) => a.tokenId - b.tokenId);
    },
    enabled: open && !!effectiveAddr && !!collectionKey,
    staleTime: 30_000,
  });

  const { data: orders } = useQuery({
    queryKey: ["marketplace-orders"],
    queryFn: getActiveOrders,
    enabled: open && !!effectiveAddr,
  });

  const activeByToken = useMemo(() => {
    const m = new Map<number, Order>();
    for (const o of orders ?? []) {
      if (o.status === "active") m.set(Number(o.tokenId), o);
    }
    return m;
  }, [orders]);

  async function handleCancel(order: Order) {
    if (!effectiveAddr) return;
    setCancellingHash(order.orderHash);
    try {
      await cancelOrder(order.orderHash, effectiveAddr);
      await queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-collection", collectionKey] });
    } finally {
      setCancellingHash(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4"
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
        className="relative z-[81] w-full max-w-lg sm:max-w-2xl max-h-[min(90dvh,720px)] sm:max-h-[min(92vh,720px)] flex flex-col rounded-t-2xl sm:rounded-2xl border border-gray-800 bg-[#0b0e11] shadow-2xl overflow-hidden pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-0"
      >
        <div className="flex items-start justify-between gap-3 px-4 py-4 border-b border-gray-800/90 shrink-0">
          <div className="min-w-0">
            <h2 id="collection-sell-modal-title" className="text-lg font-bold text-white truncate">
              List in this collection
            </h2>
            <p className="text-[12px] text-gray-500 mt-1 line-clamp-2">{collectionLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
          {!effectiveAddr ? (
            <p className="text-sm text-gray-500 text-center py-8">Connect your wallet to see assets.</p>
          ) : isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-[4/5] rounded-xl bg-gray-800/60 animate-pulse" />
              ))}
            </div>
          ) : !rows?.length ? (
            <div className="text-center py-10 space-y-2">
              <p className="text-sm text-gray-400">
                No owned RWAs match this collection&apos;s card bucket.
              </p>
              <p className="text-xs text-gray-600 max-w-sm mx-auto leading-relaxed">
                Collections are derived from graded metadata (PSA / JustTCG fields). If you expected a
                match, check that this asset was minted with the same card + grade signature.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {rows.map((asset) => {
                const imageUrl = asset.metadata?.image
                  ? resolveIpfsImage(asset.metadata.image)
                  : null;
                const order = activeByToken.get(asset.tokenId);
                const listed = !!order;

                return (
                  <div
                    key={asset.tokenId}
                    className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden flex flex-col"
                  >
                    <div className="aspect-square bg-gray-800 relative p-2">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={asset.metadata?.name ?? `#${asset.tokenId}`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                          No image
                        </div>
                      )}
                      <div className="absolute top-1.5 left-1.5 bg-black/60 text-[10px] text-gray-300 px-1.5 py-0.5 rounded-full">
                        #{asset.tokenId}
                      </div>
                      {listed && (
                        <div className="absolute top-1.5 right-1.5 bg-slate-600/90 text-[10px] text-slate-100 px-1.5 py-0.5 rounded-full">
                          Listed
                        </div>
                      )}
                    </div>
                    <div className="p-2.5 flex flex-col flex-1 min-h-0">
                      <p className="text-xs font-semibold text-white truncate">
                        {asset.metadata?.name ?? `${TOKENABLE_RWA_DISPLAY_NAME} #${asset.tokenId}`}
                      </p>
                      <div className="mt-auto pt-2">
                        {listed && order ? (
                          <>
                            <p className="text-[10px] text-mint/90 mb-1.5 font-medium tabular-nums">
                              {(Number(order.considerationAmount) / 1_000_000).toLocaleString()} USDC
                            </p>
                            <button
                              type="button"
                              onClick={() => setListingTokenId(asset.tokenId)}
                              className="w-full py-1.5 text-[11px] font-semibold bg-mint/10 hover:bg-mint/15 text-mint rounded-lg border border-mint-deep/35 mb-1.5"
                            >
                              Change price
                            </button>
                            <button
                              type="button"
                              disabled={cancellingHash === order.orderHash}
                              onClick={() => void handleCancel(order)}
                              className="w-full py-1.5 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-600/50 disabled:opacity-40"
                            >
                              {cancellingHash === order.orderHash ? "…" : "Cancel listing"}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setListingTokenId(asset.tokenId)}
                            className="w-full py-2 text-[11px] font-semibold bg-mint/10 hover:bg-mint/15 text-mint rounded-lg border border-mint-deep/35"
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
          collectionKey={collectionKey}
          collectionBids={collectionBids}
          existingAskOrder={(() => {
            const o = activeByToken.get(listingTokenId);
            return o?.side === "ask" && o.status === "active" ? o : undefined;
          })()}
          initialPriceUsdc={listPricePresetUsdc ?? undefined}
          onClose={() => setListingTokenId(null)}
          onListed={() => {
            setListingTokenId(null);
            void queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
            void queryClient.invalidateQueries({ queryKey: ["marketplace-collection", collectionKey] });
            void queryClient.invalidateQueries({ queryKey: ["merkle-set", collectionKey] });
            void queryClient.invalidateQueries({
              queryKey: ["collection-owned-rwa", effectiveAddr, collectionKey],
            });
          }}
        />
      )}
    </div>
  );
}
