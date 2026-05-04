"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  postMarketplaceCollectionSnapshotsBatched,
  rq,
  marketplaceRqPolicy,
  type CollectionListMarketSnapshot,
  type MarketplaceCollectionSummary,
} from "@/lib/core";
import { useMarketplaceCollectionsInfinite } from "@/hooks/useMarketplaceCollectionsInfinite";
import { CollectionCoverFrame } from "@/components/marketplace/CollectionCoverFrame";
import { parseGradeScoreNumber, representativeGradeUsd } from "@/lib/market";

const MAX_TRENDING_VISIBLE = 4;
const MAX_TRENDING_VISIBLE_MOBILE = 1;
const TRENDING_POOL = 10;

function formatUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 0 : 2;
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })}`;
}

export type TrendingCollectionsCarouselVariant = "markets" | "landing";

export function TrendingCollectionsCarousel({
  variant = "markets",
  snapshotByKey: snapshotByKeyProp,
  className = "",
  outerStyle,
}: {
  variant?: TrendingCollectionsCarouselVariant;
  /** When set (Markets page), skips a separate snapshots request for these cards */
  snapshotByKey?: Map<string, CollectionListMarketSnapshot>;
  className?: string;
  outerStyle?: CSSProperties;
}) {
  const { data: colPages } = useMarketplaceCollectionsInfinite();

  const collectionSummaries = useMemo(
    () => colPages?.pages.flatMap((p) => p.items) ?? [],
    [colPages],
  );

  const trendingNow = useMemo(() => {
    return [...collectionSummaries]
      .sort((a, b) => {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        if (ta !== tb) return tb - ta;
        return a.displayLabel.localeCompare(b.displayLabel);
      })
      .slice(0, TRENDING_POOL);
  }, [collectionSummaries]);

  const trendingSnapshotKeysSorted = useMemo(() => {
    const u = [...new Set(trendingNow.map((c) => c.collectionKey.toLowerCase()))];
    return u.sort();
  }, [trendingNow]);

  const fetchSnapshotsLocally = snapshotByKeyProp == null && trendingSnapshotKeysSorted.length > 0;

  const { data: snapshotPack } = useQuery({
    queryKey: rq.collectionSnapshots(trendingSnapshotKeysSorted, "365d"),
    queryFn: () =>
      postMarketplaceCollectionSnapshotsBatched(trendingSnapshotKeysSorted, "365d"),
    enabled: fetchSnapshotsLocally,
    staleTime: marketplaceRqPolicy.snapshotsStaleMs,
  });

  const snapshotByKey = useMemo(() => {
    if (snapshotByKeyProp) return snapshotByKeyProp;
    const m = new Map<string, CollectionListMarketSnapshot>();
    for (const it of snapshotPack?.items ?? []) {
      m.set(it.collectionKey.toLowerCase(), it);
    }
    return m;
  }, [snapshotByKeyProp, snapshotPack]);

  const trendingCount = trendingNow.length;

  /** < sm (640px) — stack one card per view and step the window every 2s */
  const [narrowCarousel, setNarrowCarousel] = useState(false);
  useEffect(() => {
    const mq =
      typeof window !== "undefined" ? window.matchMedia("(max-width: 639px)") : null;
    if (!mq) return;
    const sync = () => setNarrowCarousel(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const maxVisible = narrowCarousel ? MAX_TRENDING_VISIBLE_MOBILE : MAX_TRENDING_VISIBLE;
  const maxTrendingStart = Math.max(0, trendingCount - maxVisible);
  const trendingLoops = trendingCount > maxVisible;

  const [trendingStart, setTrendingStart] = useState(0);

  const [trendingPauseMotion, setTrendingPauseMotion] = useState(false);
  useEffect(() => {
    const mq =
      typeof window !== "undefined"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    if (!mq) return;
    const sync = () => setTrendingPauseMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const trendingVisible = useMemo(() => {
    const n = trendingCount;
    if (n === 0) return [];
    if (!trendingLoops) return trendingNow;
    const out: MarketplaceCollectionSummary[] = [];
    for (let i = 0; i < maxVisible; i++) {
      out.push(trendingNow[(trendingStart + i) % n]!);
    }
    return out;
  }, [trendingNow, trendingCount, trendingLoops, trendingStart, maxVisible]);

  useEffect(() => {
    if (!trendingLoops || trendingPauseMotion) return;
    const id = window.setInterval(() => {
      setTrendingStart((prev) => (prev + 1) % trendingCount);
    }, 2000);
    return () => window.clearInterval(id);
  }, [trendingLoops, trendingPauseMotion, trendingCount]);

  const scrollTrending = (dir: "left" | "right") => {
    setTrendingStart((prev) => {
      const n = trendingCount;
      if (n <= maxVisible) return 0;
      if (dir === "left") return (prev - 1 + n) % n;
      return (prev + 1) % n;
    });
  };

  if (trendingNow.length === 0) return null;

  const showHeading = variant === "markets";

  /** When motion is OK and deck rotates: remount grid so `trending-deck-shift-in` runs each step */
  const deckMotionKey =
    trendingLoops && !trendingPauseMotion
      ? `${trendingStart}-${maxVisible}-${narrowCarousel ? "m" : "d"}`
      : "deck";
  const deckMotionClass =
    trendingLoops && !trendingPauseMotion ? "trending-deck-shift-in" : "";

  const deckGridClass = narrowCarousel
    ? "grid grid-cols-1 max-w-[min(100%,280px)] mx-auto gap-4 px-10 pb-2 pt-1"
    : "grid grid-cols-1 gap-5 px-12 pb-2 pt-1 sm:grid-cols-2 xl:grid-cols-4";

  return (
    <section
      className={`${showHeading ? "mb-16 mt-2 sm:mb-20 sm:mt-4" : "mx-auto mb-10 w-full max-w-6xl sm:mb-11"} ${className}`.trim()}
      style={outerStyle}
      aria-label={showHeading ? "Trending now collections" : "Featured collections"}
    >
      {showHeading ? (
        <div className="mb-6 sm:mb-7">
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Trending Now</h2>
        </div>
      ) : null}

      <div className="relative">
        <button
          type="button"
          onClick={() => scrollTrending("left")}
          aria-label="Scroll collections left"
          disabled={!trendingLoops && trendingStart <= 0}
          className={`absolute left-0 top-1/2 z-20 -translate-y-1/2 rounded-full border bg-zinc-950/85 p-2 transition-colors ${
            trendingLoops || trendingStart > 0
              ? "border-zinc-700/80 text-zinc-300 hover:border-mint/40 hover:text-mint"
              : "cursor-not-allowed border-zinc-800/70 text-zinc-700"
          }`}
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => scrollTrending("right")}
          aria-label="Scroll collections right"
          disabled={!trendingLoops && trendingStart >= maxTrendingStart}
          className={`absolute right-0 top-1/2 z-20 -translate-y-1/2 rounded-full border bg-zinc-950/85 p-2 transition-colors ${
            trendingLoops || trendingStart < maxTrendingStart
              ? "border-zinc-700/80 text-zinc-300 hover:border-mint/40 hover:text-mint"
              : "cursor-not-allowed border-zinc-800/70 text-zinc-700"
          }`}
        >
          ›
        </button>

        <div key={deckMotionKey} className={`${deckGridClass} ${deckMotionClass}`.trim()}>
          {trendingVisible.map((c) => {
            const s = snapshotByKey.get(c.collectionKey.toLowerCase());
            const ms = s?.marketStats ?? null;
            const tokenablePrice =
              ms?.floor != null && Number.isFinite(ms.floor) && ms.floor > 0
                ? ms.floor
                : s?.lastTokenableTradeUsdc != null &&
                    Number.isFinite(s.lastTokenableTradeUsdc) &&
                    s.lastTokenableTradeUsdc > 0
                  ? s.lastTokenableTradeUsdc
                  : null;
            const comp = c.components as { gradeScore?: string };
            const eBayPrice = representativeGradeUsd(
              s?.gradePrices ?? null,
              parseGradeScoreNumber(comp.gradeScore),
            );
            return (
              <Link
                key={c.collectionKey}
                href={`/marketplace/collections/${encodeURIComponent(c.collectionKey)}`}
                className="group w-full"
              >
                <div className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-[#0d1118] transition-colors group-hover:border-mint/35">
                  <div className="aspect-[3/4] bg-[#0a0e14]">
                    {c.coverImageUrl ? (
                      <CollectionCoverFrame
                        imageUrl={c.coverImageUrl}
                        variant="compact"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-zinc-900" />
                    )}
                  </div>
                  <div className="space-y-1.5 p-3">
                    <p className="truncate text-lg font-semibold text-white">{c.displayLabel}</p>
                    <div className="space-y-1 text-sm">
                      <p className="flex items-center justify-between gap-2">
                        <span className="text-zinc-500">Market Price</span>
                        <span className="font-semibold tabular-nums text-cyan-300">
                          {eBayPrice != null && Number.isFinite(eBayPrice) && eBayPrice > 0
                            ? formatUsd(eBayPrice)
                            : "—"}
                        </span>
                      </p>
                      <p className="flex items-center justify-between gap-2">
                        <span className="text-zinc-500">Tokenable</span>
                        <span className="font-semibold tabular-nums text-emerald-300">
                          {tokenablePrice != null ? formatUsd(tokenablePrice) : "—"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
