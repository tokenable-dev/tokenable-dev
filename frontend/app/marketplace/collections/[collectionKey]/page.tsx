"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { getMarketplaceCollectionDetail, type Order } from "@/lib/api";
import { CollectionCoverFrame } from "@/components/marketplace/CollectionCoverFrame";
import { CollectionUnifiedOrderBook } from "@/components/marketplace/CollectionUnifiedOrderBook";
import { CollectionTradeGuide } from "@/components/marketplace/CollectionTradeGuide";
import { CollectionCriteriaBidPanel } from "@/components/marketplace/CollectionCriteriaBidPanel";
import { CollectionOwnedRwaListModal } from "@/components/marketplace/CollectionOwnedRwaListModal";
import { CollectionRwaCard } from "@/components/marketplace/CollectionRwaCard";
import { useAppStore, selectWallet } from "@/store";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteriaMatch";

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

function sortedTokenIds(asks: Order[]): number[] {
  const s = new Set<number>();
  for (const o of asks) {
    const id = Number(o.tokenId);
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
  const [showTokenGrid, setShowTokenGrid] = useState(false);
  const [sellModalOpen, setSellModalOpen] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["marketplace-collection", key],
    queryFn: () => getMarketplaceCollectionDetail(key),
    enabled: key.length > 0,
    retry: false,
  });

  function invalidateCollection() {
    void queryClient.invalidateQueries({ queryKey: ["marketplace-collection", key] });
    void queryClient.invalidateQueries({ queryKey: ["merkle-set", key] });
    void queryClient.invalidateQueries({ queryKey: ["merkle-set"] });
  }

  const asks = useMemo(
    () => (data ? data.listings.filter((o) => o.side !== "bid") : []),
    [data]
  );

  const collectionBids = useMemo(() => {
    if (!data?.collectionBids) return [];
    return data.collectionBids.filter((b) => b.status === "active");
  }, [data?.collectionBids]);

  const criteriaBidCount = useMemo(
    () => collectionBids.filter((b) => isCriteriaCollectionBid(b)).length,
    [collectionBids]
  );

  const askMap = useMemo(() => bestAskByToken(asks), [asks]);
  const tokenIds = useMemo(() => (data ? sortedTokenIds(asks) : []), [data, asks]);

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
          <div className="rounded-2xl border border-gray-800/90 bg-[#0b0e11] overflow-hidden animate-pulse mb-8">
            <div className="flex justify-center px-8 pt-10 pb-8">
              <div className="aspect-[3/4] w-full max-w-[280px] rounded-2xl bg-gray-800/60" />
            </div>
            <div className="border-t border-gray-800/70 px-8 py-7 space-y-4">
              <div className="h-3 w-24 bg-gray-800/70 rounded mx-auto sm:mx-0" />
              <div className="h-8 w-full max-w-md bg-gray-800/60 rounded mx-auto sm:mx-0" />
              <div className="h-20 bg-gray-800/40 rounded-xl" />
            </div>
          </div>
          <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden min-h-[280px]">
              <div className="h-10 bg-gray-800/80 border-b border-gray-800" />
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-11 border-b border-gray-800/50 bg-gray-900/30" />
              ))}
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 min-h-[200px] animate-pulse" />
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

  const { collection, representativeImageUrl } = data;

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

        <header className="mb-8 xl:mb-10 rounded-2xl border border-gray-800/90 bg-gradient-to-b from-[#0d1218] via-[#0b0e11] to-[#080a0d] shadow-[0_24px_48px_-28px_rgba(0,0,0,0.85)] overflow-hidden">
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
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1 text-[11px] font-medium text-emerald-200/90 tabular-nums">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" aria-hidden />
                  {criteriaBidCount} collection bid{criteriaBidCount === 1 ? "" : "s"}
                </span>
              </div>

              <div className="flex flex-wrap justify-center gap-3 pt-1 sm:justify-start">
                <button
                  type="button"
                  onClick={() => setSellModalOpen(true)}
                  className="inline-flex items-center justify-center rounded-xl border border-mint/25 bg-mint/[0.08] px-5 py-2.5 text-sm font-semibold text-mint/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:bg-mint/[0.12] hover:border-mint/40"
                >
                  List for sale in this collection
                </button>
              </div>
            </div>
          </header>

        <section
          className="xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(300px,400px)] xl:gap-5 xl:items-start space-y-5 xl:space-y-0 mb-10"
          id="collection-trading"
          aria-label="Collection market"
        >
          <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
            <CollectionUnifiedOrderBook
              collectionKey={collection.collectionKey}
              asks={asks}
              collectionBids={collectionBids}
              address={address}
              onInvalidate={invalidateCollection}
            />
          </div>
          <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
            <CollectionCriteriaBidPanel
              collectionKey={collection.collectionKey}
              activeAsks={asks}
              connectedAddress={address ?? undefined}
              onPlaced={() => invalidateCollection()}
              onOpenSellModal={() => setSellModalOpen(true)}
            />
          </div>
        </section>

        <section className="mb-10 mt-10 border-t border-gray-800/80 pt-8" id="browse-tokens">
          <button
            type="button"
            onClick={() => setShowTokenGrid((v) => !v)}
            className="flex w-full items-center justify-between gap-3 text-left rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3 text-sm font-semibold text-gray-200 hover:bg-gray-900/70 hover:border-gray-700 transition-colors"
          >
            <span>
              Browse by token{" "}
              <span className="text-gray-500 font-normal">
                ({tokenIds.length} token{tokenIds.length === 1 ? "" : "s"} listed)
              </span>
            </span>
            <span className="text-gray-500 tabular-nums">{showTokenGrid ? "−" : "+"}</span>
          </button>
          <p className="text-xs text-gray-600 mt-2 px-1">
            Optional grid — same listings as above. Match criteria bids from each token page.
          </p>

          {showTokenGrid && (
            <div className="mt-4">
              {tokenIds.length === 0 ? (
                <div className="rounded-2xl border border-gray-800 bg-gray-900/30 px-4 py-8 text-center text-sm text-gray-400">
                  No listings yet. List an asset from{" "}
                  <Link href="/?tab=my-rwa" className="text-mint hover:underline">
                    My Assets
                  </Link>
                  .
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5">
                  {tokenIds.map((tid) => (
                    <CollectionRwaCard
                      key={tid}
                      tokenId={tid}
                      collectionKey={key}
                      listing={askMap.get(tid) ?? null}
                      collectionBidCount={criteriaBidCount}
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

      <CollectionOwnedRwaListModal
        open={sellModalOpen}
        onClose={() => setSellModalOpen(false)}
        collectionKey={collection.collectionKey}
        collectionLabel={collection.displayLabel}
      />
    </div>
  );
}
