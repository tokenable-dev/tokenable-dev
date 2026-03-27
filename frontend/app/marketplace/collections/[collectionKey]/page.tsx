"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  cancelPoolBid,
  getMarketplaceCollectionDetail,
  type BucketBid,
  type Order,
} from "@/lib/api";
import { CollectionCoverFrame } from "@/components/marketplace/CollectionCoverFrame";
import { CollectionUnifiedOrderBook } from "@/components/marketplace/CollectionUnifiedOrderBook";
import { CollectionTradeGuide } from "@/components/marketplace/CollectionTradeGuide";
import { PoolBidsPanel } from "@/components/marketplace/PoolBidsPanel";
import { CollectionNftCard } from "@/components/marketplace/CollectionNftCard";
import { useAppStore, selectWallet } from "@/store";

/** 활성 매도 중 tokenId당 최저가 리스팅 */
function bestAskByToken(asks: Order[]): Map<number, Order> {
  const m = new Map<number, Order>();
  for (const o of asks) {
    const id = Number(o.tokenId);
    if (!Number.isFinite(id)) continue;
    const prev = m.get(id);
    if (!prev) {
      m.set(id, o);
      continue;
    }
    try {
      if (BigInt(o.considerationAmount) < BigInt(prev.considerationAmount)) {
        m.set(id, o);
      }
    } catch {
      m.set(id, o);
    }
  }
  return m;
}

function seaportBidCountsByToken(bids: Order[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const b of bids) {
    const id = Number(b.tokenId);
    if (!Number.isFinite(id)) continue;
    m.set(id, (m.get(id) ?? 0) + 1);
  }
  return m;
}

function sortedTokenIds(asks: Order[], seaportBids: Order[]): number[] {
  const s = new Set<number>();
  for (const o of asks) {
    const id = Number(o.tokenId);
    if (Number.isFinite(id)) s.add(id);
  }
  for (const b of seaportBids) {
    const id = Number(b.tokenId);
    if (Number.isFinite(id)) s.add(id);
  }
  return [...s].sort((a, b) => a - b);
}

export default function MarketplaceCollectionPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const { address } = useAppStore(useShallow(selectWallet));
  const raw = params.collectionKey;
  const collectionKey = Array.isArray(raw) ? raw[0] : raw;
  const key = typeof collectionKey === "string" ? decodeURIComponent(collectionKey) : "";
  const [sellerTokenInput, setSellerTokenInput] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["marketplace-collection", key],
    queryFn: () => getMarketplaceCollectionDetail(key),
    enabled: key.length > 0,
    retry: false,
  });

  async function handleCancelPoolBid(bid: BucketBid) {
    if (!address) return;
    await cancelPoolBid(bid.id, address);
    await queryClient.invalidateQueries({ queryKey: ["marketplace-collection", key] });
  }

  function invalidateCollection() {
    void queryClient.invalidateQueries({ queryKey: ["marketplace-collection", key] });
  }

  const asks = useMemo(
    () => (data ? data.listings.filter((o) => o.side !== "bid") : []),
    [data]
  );

  const askMap = useMemo(() => bestAskByToken(asks), [asks]);
  const bidCountMap = useMemo(
    () => (data ? seaportBidCountsByToken(data.seaportBids) : new Map<number, number>()),
    [data]
  );
  const tokenIds = useMemo(
    () => (data ? sortedTokenIds(asks, data.seaportBids) : []),
    [data, asks]
  );

  if (!key) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-gray-500 text-sm">
        Invalid collection.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="h-8 w-48 bg-gray-800 rounded animate-pulse mb-8" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="aspect-[3/4] rounded-2xl bg-gray-800/80 border border-gray-800 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <p className="text-red-400 text-sm mb-4">
          {error instanceof Error ? error.message : "Collection not found."}
        </p>
        <Link href="/?tab=marketplace" className="text-mint text-sm hover:underline">
          ← Back to Exchange
        </Link>
      </div>
    );
  }

  const { collection, poolBids, seaportBids, representativeImageUrl } = data;
  const anchorTokenId =
    asks.length > 0 ? Math.min(...asks.map((o) => Number(o.tokenId))) : null;

  const comp = collection.components as {
    cardName?: string;
    gradingCompany?: string;
    gradeScore?: string;
    cardSet?: string;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-20">
        <Link
          href="/?tab=marketplace"
          className="inline-flex text-sm text-mint/90 hover:text-mint mb-6"
        >
          ← Back to Exchange
        </Link>

        <header className="mb-8 flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
          <div
            className="flex w-full shrink-0 justify-center lg:w-[min(200px,100%)] lg:flex-none lg:justify-start"
            title="Collection representative image"
          >
            {representativeImageUrl ? (
              <CollectionCoverFrame
                imageUrl={representativeImageUrl}
                variant="featured"
                className="shrink-0"
              />
            ) : (
              <div className="aspect-[3/4] max-h-[220px] rounded-2xl border border-gray-800/90 bg-gradient-to-br from-gray-900 to-gray-950 flex items-center justify-center p-4 text-center text-[11px] text-gray-500">
                No preview
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-mint/75">
              Collection
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
              {collection.displayLabel}
            </h1>

            {(comp.cardName || comp.gradingCompany || comp.gradeScore) && (
              <dl className="flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
                {comp.cardName && (
                  <div>
                    <dt className="text-[10px] uppercase text-gray-500">Card</dt>
                    <dd className="text-gray-200 capitalize">{comp.cardName}</dd>
                  </div>
                )}
                {comp.gradingCompany && (
                  <div>
                    <dt className="text-[10px] uppercase text-gray-500">Grader</dt>
                    <dd className="text-gray-200 uppercase">{comp.gradingCompany}</dd>
                  </div>
                )}
                {comp.gradeScore && (
                  <div>
                    <dt className="text-[10px] uppercase text-gray-500">Grade</dt>
                    <dd className="text-gray-200">{comp.gradeScore}</dd>
                  </div>
                )}
                {comp.cardSet && (
                  <div className="w-full">
                    <dt className="text-[10px] uppercase text-gray-500">Set</dt>
                    <dd className="text-gray-300 text-xs">{comp.cardSet}</dd>
                  </div>
                )}
              </dl>
            )}

            {collection.queryUsed && (
              <p className="text-xs text-gray-500">
                <span className="text-gray-600">JustTCG query:</span> {collection.queryUsed}
              </p>
            )}

            <p className="text-sm text-gray-400">
              <span className="text-rose-300/90 font-medium">{asks.length}</span> listing
              {asks.length === 1 ? "" : "s"}
              <span className="text-gray-600 mx-2">·</span>
              <span className="text-emerald-300/90 font-medium">{poolBids.length}</span> pool bid
              {poolBids.length === 1 ? "" : "s"}
              <span className="text-gray-600 mx-2">·</span>
              <span className="text-emerald-300/80 font-medium">{seaportBids.length}</span> Seaport
              bid{seaportBids.length === 1 ? "" : "s"}
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href="/?tab=my-nfts"
                className="inline-flex items-center rounded-xl border border-gray-700 bg-gray-800/50 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-800 hover:border-gray-600 transition-colors"
              >
                My Assets (sell)
              </Link>
            </div>
          </div>
        </header>

        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4">Assets in this collection</h2>
          {tokenIds.length === 0 ? (
            <div className="rounded-2xl border border-gray-800 bg-gray-900/30 px-4 py-8 text-center text-sm text-gray-400">
              No token-specific listings or bids yet. Pool bids below may still apply to graded
              matches — list an asset from{" "}
              <Link href="/?tab=my-nfts" className="text-mint hover:underline">
                My Assets
              </Link>
              .
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5">
              {tokenIds.map((tid) => (
                <CollectionNftCard
                  key={tid}
                  tokenId={tid}
                  collectionKey={key}
                  listing={askMap.get(tid) ?? null}
                  seaportBidCount={bidCountMap.get(tid) ?? 0}
                  address={address}
                />
              ))}
            </div>
          )}
        </section>

        <PoolBidsPanel
          collectionContext={{
            bucketKey: collection.collectionKey,
            components: collection.components,
            bids: poolBids,
            buyerLinkTokenId: anchorTokenId ?? undefined,
            onInvalidate: invalidateCollection,
          }}
          hideBidList
          address={address}
          isOwner={false}
        />

        <div className="mt-10 border-t border-gray-800/80 pt-8">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-gray-300 hover:text-white py-2"
          >
            <span>Advanced: full order book &amp; guides</span>
            <span className="text-gray-500 tabular-nums">{showAdvanced ? "−" : "+"}</span>
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-6">
              <CollectionTradeGuide />
              <CollectionUnifiedOrderBook
                asks={asks}
                poolBids={poolBids}
                seaportBids={seaportBids}
                address={address}
                onCancelPoolBid={(b) => void handleCancelPoolBid(b)}
                sellerTokenInput={sellerTokenInput}
                onSellerTokenInput={setSellerTokenInput}
                variant="full"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
