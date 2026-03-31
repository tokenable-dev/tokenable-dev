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
  const [showAdvanced, setShowAdvanced] = useState(false);
  /** Token card grid is secondary; primary view is the collection order book. */
  const [showTokenGrid, setShowTokenGrid] = useState(false);

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
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-20">
          <div className="h-4 w-40 bg-gray-800/80 rounded animate-pulse mb-6" />
          <div className="lg:grid lg:grid-cols-2 lg:gap-10">
            <div className="rounded-2xl border border-gray-800/90 bg-[#0b0e11] overflow-hidden animate-pulse">
              <div className="flex justify-center px-8 pt-10 pb-8">
                <div className="aspect-[3/4] w-full max-w-[280px] rounded-2xl bg-gray-800/60" />
              </div>
              <div className="border-t border-gray-800/70 px-8 py-7 space-y-4">
                <div className="h-3 w-24 bg-gray-800/70 rounded mx-auto sm:mx-0" />
                <div className="h-8 w-full max-w-md bg-gray-800/60 rounded mx-auto sm:mx-0" />
                <div className="h-20 bg-gray-800/40 rounded-xl" />
              </div>
            </div>
            <div className="mt-8 lg:mt-0 rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
              <div className="h-10 bg-gray-800/80 border-b border-gray-800" />
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-11 border-b border-gray-800/50 bg-gray-900/30" />
              ))}
            </div>
          </div>
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

        <div className="lg:grid lg:grid-cols-2 lg:gap-10 lg:items-start">
          <header className="mb-8 lg:mb-0 rounded-2xl border border-gray-800/90 bg-gradient-to-b from-[#0d1218] via-[#0b0e11] to-[#080a0d] shadow-[0_24px_48px_-28px_rgba(0,0,0,0.85)] overflow-hidden">
            <div
              className="relative flex justify-center px-5 pt-8 pb-6 sm:px-8 sm:pt-10 sm:pb-8 lg:px-10"
              title="Collection representative image"
            >
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_35%,rgba(52,211,153,0.09),transparent_55%)]"
                aria-hidden
              />
              {representativeImageUrl ? (
                <CollectionCoverFrame
                  imageUrl={representativeImageUrl}
                  variant="hero"
                  className="relative z-[1] shrink-0"
                />
              ) : (
                <div className="relative z-[1] flex aspect-[3/4] w-full max-w-[min(100%,260px)] sm:max-w-[280px] lg:max-w-[300px] items-center justify-center rounded-2xl border border-gray-800/90 bg-gradient-to-br from-gray-900/90 to-gray-950 p-6 text-center text-[12px] text-gray-500">
                  No preview
                </div>
              )}
            </div>

            <div className="min-w-0 space-y-5 border-t border-gray-800/70 px-5 py-6 sm:px-8 sm:py-7 lg:px-10">
              <div className="space-y-2 text-center sm:text-left">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-mint/70">
                  Collection
                </p>
                <h1
                  className="font-sans text-balance text-lg sm:text-xl lg:text-[1.375rem] font-semibold tracking-[-0.03em] leading-snug text-white antialiased [text-shadow:0_1px_0_rgba(255,255,255,0.05),0_8px_28px_rgba(0,0,0,0.35)]"
                >
                  {collection.displayLabel}
                </h1>
              </div>

              {(comp.cardName || comp.gradingCompany || comp.gradeScore || comp.cardSet) && (
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3">
                  {comp.cardName && (
                    <div className="rounded-xl border border-gray-800/80 bg-black/25 px-3 py-2.5 sm:col-span-2">
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                        Card
                      </dt>
                      <dd className="mt-0.5 text-[13px] font-medium text-gray-100 capitalize leading-snug">
                        {comp.cardName}
                      </dd>
                    </div>
                  )}
                  {comp.gradingCompany && (
                    <div className="rounded-xl border border-gray-800/80 bg-black/25 px-3 py-2.5">
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                        Grader
                      </dt>
                      <dd className="mt-0.5 text-[13px] font-medium text-gray-100 uppercase">
                        {comp.gradingCompany}
                      </dd>
                    </div>
                  )}
                  {comp.gradeScore && (
                    <div className="rounded-xl border border-gray-800/80 bg-black/25 px-3 py-2.5">
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                        Grade
                      </dt>
                      <dd className="mt-0.5 text-[13px] font-medium text-gray-100 tabular-nums">
                        {comp.gradeScore}
                      </dd>
                    </div>
                  )}
                  {comp.cardSet && (
                    <div className="col-span-2 rounded-xl border border-gray-800/80 bg-black/25 px-3 py-2.5">
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                        Set
                      </dt>
                      <dd className="mt-0.5 text-xs text-gray-300 leading-relaxed">{comp.cardSet}</dd>
                    </div>
                  )}
                </dl>
              )}

              {collection.queryUsed && (
                <p className="rounded-lg bg-black/30 px-3 py-2 text-[11px] leading-relaxed text-gray-500 font-mono break-all border border-gray-800/50">
                  <span className="font-sans text-gray-600 not-italic">JustTCG</span>{" "}
                  {collection.queryUsed}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/[0.06] px-3 py-1 text-[11px] font-medium text-rose-200/90 tabular-nums">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400/90" aria-hidden />
                  {asks.length} listing{asks.length === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/[0.06] px-3 py-1 text-[11px] font-medium text-cyan-200/90 tabular-nums">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/80" aria-hidden />
                  {poolBids.length} pool
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1 text-[11px] font-medium text-emerald-200/90 tabular-nums">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" aria-hidden />
                  {seaportBids.length} Seaport
                </span>
              </div>

              <div className="flex flex-wrap justify-center gap-3 pt-1 sm:justify-start">
                <Link
                  href="/?tab=my-nfts"
                  className="inline-flex items-center justify-center rounded-xl border border-mint/25 bg-mint/[0.08] px-5 py-2.5 text-sm font-semibold text-mint/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:bg-mint/[0.12] hover:border-mint/40"
                >
                  My Assets — sell
                </Link>
              </div>
            </div>
          </header>

          <div className="min-w-0 lg:sticky lg:top-4 lg:self-start space-y-5">
            <section className="mb-0" id="collection-orderbook">
              <h2 className="text-lg font-bold text-white mb-2">Order book</h2>
              <CollectionUnifiedOrderBook
                asks={asks}
                poolBids={poolBids}
                seaportBids={seaportBids}
                address={address}
                onCancelPoolBid={(b) => void handleCancelPoolBid(b)}
                variant="full"
                showPoolInBuySide
                collectionLabel={collection.displayLabel}
              />
              <div className="mt-5" id="pool-bids-section">
                <h3 className="text-sm font-semibold text-gray-200 mb-2">Place a pool bid</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Collection-wide buy price (EIP-712). New bids appear in the book above; sellers match from an asset page.
                </p>
                <PoolBidsPanel
                  variant="collection"
                  hideBidList
                  collectionContext={{
                    bucketKey: collection.collectionKey,
                    components: collection.components,
                    bids: poolBids,
                    buyerLinkTokenId: anchorTokenId ?? undefined,
                    onInvalidate: invalidateCollection,
                  }}
                  address={address}
                  isOwner={false}
                />
              </div>
            </section>
          </div>
        </div>

        <section className="mb-10 mt-10 border-t border-gray-800/80 pt-8" id="browse-tokens">
          <button
            type="button"
            onClick={() => setShowTokenGrid((v) => !v)}
            className="flex w-full items-center justify-between gap-3 text-left rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3 text-sm font-semibold text-gray-200 hover:bg-gray-900/70 hover:border-gray-700 transition-colors"
          >
            <span>
              Browse by token{" "}
              <span className="text-gray-500 font-normal">
                ({tokenIds.length} token{tokenIds.length === 1 ? "" : "s"} with activity)
              </span>
            </span>
            <span className="text-gray-500 tabular-nums">{showTokenGrid ? "−" : "+"}</span>
          </button>
          <p className="text-xs text-gray-600 mt-2 px-1">
            Optional: card grid by token ID — same listings as the order book above, different layout.
          </p>

          {showTokenGrid && (
            <div className="mt-4">
              {tokenIds.length === 0 ? (
                <div className="rounded-2xl border border-gray-800 bg-gray-900/30 px-4 py-8 text-center text-sm text-gray-400">
                  No token-specific listings or bids yet. Pool bids may still apply — list an asset from{" "}
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
            </div>
          )}
        </section>

        <div className="mt-10 border-t border-gray-800/80 pt-8">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-gray-300 hover:text-white py-2"
          >
            <span>Advanced: trading guide</span>
            <span className="text-gray-500 tabular-nums">{showAdvanced ? "−" : "+"}</span>
          </button>

          {showAdvanced && (
            <div className="mt-4">
              <CollectionTradeGuide />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
