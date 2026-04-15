"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { Address } from "viem";
import { formatUnits } from "viem";
import { getMarketplaceCollectionDetail, type Order } from "@/lib/api";
import {
  CollectionOverviewBoard,
  type CollectionOverviewStat,
} from "@/components/marketplace/CollectionOverviewBoard";
import {
  CollectionTradeTicket,
  type BookRowSelection,
} from "@/components/marketplace/CollectionTradeTicket";
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

function bidDisplayUsdc(b: Order): number {
  let display = Number(b.considerationAmount) / 1_000_000;
  try {
    const offer0 = b.parameters?.offer?.[0];
    if (offer0?.startAmount) display = Number(formatUnits(BigInt(offer0.startAmount), 6));
  } catch {
    /* keep considerationAmount */
  }
  return display;
}

export default function MarketplaceCollectionPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const { address } = useAppStore(useShallow(selectWallet));
  const raw = params.collectionKey;
  const collectionKey = Array.isArray(raw) ? raw[0] : raw;
  const key = typeof collectionKey === "string" ? decodeURIComponent(collectionKey) : "";
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [bookSelection, setBookSelection] = useState<BookRowSelection | null>(null);

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

  const comp = useMemo(() => {
    const raw = data?.collection?.components as
      | {
          cardName?: string;
          gradingCompany?: string;
          gradeScore?: string;
          cardSet?: string;
          cardNumber?: string;
          variant?: string;
        }
      | undefined;
    return raw ?? {};
  }, [data?.collection?.components]);

  const metadataRows = useMemo(() => {
    const rows: { label: string; value: string }[] = [];
    if (comp.cardName) rows.push({ label: "Card", value: comp.cardName });
    if (comp.cardSet) rows.push({ label: "Set", value: comp.cardSet });
    if (comp.cardNumber) rows.push({ label: "Card #", value: comp.cardNumber });
    if (comp.variant) rows.push({ label: "Variant", value: comp.variant });
    if (comp.gradingCompany) rows.push({ label: "Grader", value: comp.gradingCompany });
    if (comp.gradeScore) rows.push({ label: "Grade", value: comp.gradeScore });
    return rows;
  }, [comp]);

  const subtitle = useMemo(() => {
    const parts = [comp.cardSet, comp.cardNumber].filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0
    );
    return parts.length ? parts.join(" · ") : null;
  }, [comp.cardSet, comp.cardNumber]);

  const marketMetrics = useMemo(() => {
    const askPrices = asks
      .filter((o) => String(o.side ?? "ask").toLowerCase() !== "bid")
      .map((o) => Number(o.considerationAmount) / 1_000_000)
      .filter((n) => Number.isFinite(n));
    const floor = askPrices.length ? Math.min(...askPrices) : null;
    const listingsNotional = askPrices.reduce((a, b) => a + b, 0);

    let bestBid: number | null = null;
    for (const b of collectionBids) {
      if (!isCriteriaCollectionBid(b) || b.status !== "active") continue;
      const d = bidDisplayUsdc(b);
      if (bestBid == null || d > bestBid) bestBid = d;
    }

    let spreadPct: number | null = null;
    if (floor != null && bestBid != null && floor > 0 && bestBid > 0) {
      const mid = (floor + bestBid) / 2;
      if (mid > 0) spreadPct = (Math.abs(floor - bestBid) / mid) * 100;
    }

    return { floor, listingsNotional, spreadPct };
  }, [asks, collectionBids]);

  const overviewStats: CollectionOverviewStat[] = useMemo(
    () => [
      {
        label: "Floor (ask)",
        value:
          marketMetrics.floor != null
            ? `$${marketMetrics.floor.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : "—",
        tone: "neutral",
        sub: "USDC",
      },
      {
        label: "24h change",
        value: "—",
        tone: "neutral",
        sub: "Historical data soon",
      },
      {
        label: "Book spread",
        value:
          marketMetrics.spreadPct != null
            ? `${marketMetrics.spreadPct.toFixed(1)}%`
            : "—",
        tone: "neutral",
        sub: "Floor vs best bid",
      },
      {
        label: "Listings notional",
        value: `$${marketMetrics.listingsNotional.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        tone: "neutral",
        sub: "Sum of active asks",
      },
    ],
    [marketMetrics.floor, marketMetrics.listingsNotional, marketMetrics.spreadPct]
  );

  const presetPriceFromBook = useMemo(() => {
    if (bookSelection?.side !== "bid") return null;
    return bookSelection.price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [bookSelection]);

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
          <div className="rounded-2xl border border-gray-800/90 bg-[#0b0e11] overflow-hidden animate-pulse mb-10">
            <div className="h-12 border-b border-gray-800/80 bg-gray-900/40" />
            <div className="grid gap-6 p-6 lg:grid-cols-[260px_1fr_320px]">
              <div className="flex justify-center">
                <div className="aspect-[3/4] w-full max-w-[240px] rounded-2xl bg-gray-800/60" />
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-16 rounded-xl bg-gray-800/50" />
                  ))}
                </div>
                <div className="h-40 rounded-xl bg-gray-800/40" />
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-900/40 min-h-[260px]" />
            </div>
          </div>
          <div className="flex gap-4 overflow-hidden">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-72 w-[200px] shrink-0 rounded-2xl bg-gray-800/40 border border-gray-800/80"
              />
            ))}
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
        <Link href="/exchange" className="text-mint text-sm hover:underline">
          ← Back to Exchange
        </Link>
      </div>
    );
  }

  const { collection, representativeImageUrl } = data;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-20">
        <Link
          href="/exchange"
          className="inline-flex text-sm text-mint/90 hover:text-mint mb-6"
        >
          ← Back to Exchange
        </Link>

        <CollectionOverviewBoard
          title={collection.displayLabel}
          subtitle={subtitle}
          badgeLabel="Collection"
          imageUrl={representativeImageUrl}
          metadataRows={metadataRows}
          stats={overviewStats}
          listingCount={asks.length}
          orderBook={
            <CollectionUnifiedOrderBook
              collectionKey={collection.collectionKey}
              asks={asks}
              collectionBids={collectionBids}
              address={address}
              onInvalidate={invalidateCollection}
              onSelectLevel={(sel) => setBookSelection(sel)}
              selectedLevelKey={bookSelection?.levelKey ?? null}
            />
          }
          tradeTicket={
            <CollectionTradeTicket
              selection={bookSelection}
              address={address as Address | undefined}
              onBuySuccess={() => invalidateCollection()}
              onOpenSellModal={() => setSellModalOpen(true)}
            />
          }
        />

        {collection.queryUsed && (
          <p className="mt-4 rounded-lg border border-gray-800/50 bg-black/30 px-3 py-2 text-[11px] leading-relaxed text-gray-500 font-mono break-all">
            <span className="font-sans text-gray-600 not-italic">JustTCG</span> {collection.queryUsed}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/[0.06] px-3 py-1 font-medium text-rose-200/90 tabular-nums">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400/90" aria-hidden />
            {asks.length} listing{asks.length === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1 font-medium text-emerald-200/90 tabular-nums">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" aria-hidden />
            {criteriaBidCount} collection bid{criteriaBidCount === 1 ? "" : "s"}
          </span>
        </div>

        <section
          className="mt-10 rounded-2xl border border-gray-800/80 bg-[#07090c]/90 overflow-hidden"
          id="collection-bid-panel"
          aria-label="Place a collection bid"
        >
          <div className="border-b border-gray-800/80 px-4 sm:px-6 py-4">
            <h2 className="text-sm font-semibold text-white tracking-tight">Buy · Collection bid</h2>
            <p className="text-[11px] text-gray-500 mt-1">
              Cross the book at the floor or place a criteria bid for any listed asset in this
              collection.
            </p>
          </div>
          <div className="p-3 sm:p-5">
            <CollectionCriteriaBidPanel
              collectionKey={collection.collectionKey}
              activeAsks={asks}
              connectedAddress={address ?? undefined}
              onPlaced={() => invalidateCollection()}
              onOpenSellModal={() => setSellModalOpen(true)}
              presetPriceFromBook={presetPriceFromBook}
            />
          </div>
        </section>

        <section
          className="mb-10 mt-12 border-t border-gray-800/80 pt-10"
          id="collection-listings"
          aria-label="Individual listings"
        >
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white tracking-tight">Individual listings</h2>
            <p className="text-xs text-gray-500 mt-1">
              Each listed token in this collection ({tokenIds.length} listed)
            </p>
          </div>

          {tokenIds.length === 0 ? (
            <div className="rounded-2xl border border-gray-800 bg-gray-900/30 px-4 py-8 text-center text-sm text-gray-400">
              No listings yet. List an asset from{" "}
              <Link href="/portfolio" className="text-mint hover:underline">
                My Assets
              </Link>
              .
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 pt-1 snap-x">
              {tokenIds.map((tid) => (
                <div
                  key={tid}
                  className="w-[min(100%,240px)] shrink-0 snap-start sm:w-[220px]"
                >
                  <CollectionRwaCard
                    tokenId={tid}
                    collectionKey={key}
                    listing={askMap.get(tid) ?? null}
                    collectionBidCount={criteriaBidCount}
                    address={address}
                  />
                </div>
              ))}
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
