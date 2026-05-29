"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
import {
  collectionMatchesCategoryFilter,
  formatReferenceChangeCoverageHint,
  formatReferenceChangePeriodFromSnapshotMeta,
  parseGradeScoreNumber,
  referenceChangePeriodFromSnapshotMeta,
  representativeGradeUsd,
  type CollectionCategoryFilterId,
} from "@/lib/market";
import { ExchangeListingPriceWithChange } from "@/components/marketplace/ExchangeListingPrice";
import { toCardDisplayUppercase } from "@/lib/marketplace/collectionFullDetailsTitle";

const MAX_TRENDING_VISIBLE = 4;
const MAX_TRENDING_VISIBLE_MOBILE = 1;
const TRENDING_POOL = 10;
const CAROUSEL_AUTO_INTERVAL_MS = 5000;

function marketplaceSummaryHasPsaCertNumber(components: Record<string, unknown> | undefined): boolean {
  const n = components?.psaCertNumber;
  return typeof n === "string" && n.trim().length > 0;
}

function trendingCarouselImageUrl(c: MarketplaceCollectionSummary): string | null {
  // Representative cover image (no cert label) takes priority
  const cover = c.coverImageUrl?.trim();
  if (cover && cover.length > 0) return cover;
  // Fall back to PSA slab image if no cover is available
  const comp = c.components as Record<string, unknown> | undefined;
  const slab =
    typeof comp?.trendingSlabImageUrl === "string" ? comp.trendingSlabImageUrl.trim() : "";
  return slab || null;
}

const CAROUSEL_SLIDE_TRANSITION_MS = 520;
const SWIPE_THRESHOLD_PX = 48;
const SWIPE_SUPPRESS_NAV_MS = 450;
/** Before locking horizontal carousel swipe, require clear axis intent (px). */
const SWIPE_AXIS_LOCK_PX = 10;

export type TrendingCollectionsCarouselVariant = "markets" | "landing";

export function TrendingCollectionsCarousel({
  variant = "markets",
  snapshotByKey: snapshotByKeyProp,
  className = "",
  outerStyle,
  hideTitle = false,
  listingCategoryFilter,
}: {
  variant?: TrendingCollectionsCarouselVariant;
  /** When set (Markets page), skips a separate snapshots request for these cards */
  snapshotByKey?: Map<string, CollectionListMarketSnapshot>;
  className?: string;
  outerStyle?: CSSProperties;
  /** Markets only: carousel without "Trending Now" heading */
  hideTitle?: boolean;
  /**
   * When set (Markets listing carousel): filter/sort slide pool before taking the first
   * `TRENDING_POOL` collections. Separate from trading-list category on the exchange page.
   */
  listingCategoryFilter?: CollectionCategoryFilterId;
}) {
  const { data: colPages, isPending: collectionsPending } = useMarketplaceCollectionsInfinite();

  const collectionSummaries = useMemo(
    () => colPages?.pages.flatMap((p) => p.items) ?? [],
    [colPages],
  );

  const listingCategoryEffective = listingCategoryFilter ?? "all";

  const trendingNow = useMemo(() => {
    const sorted = [...collectionSummaries].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      if (ta !== tb) return tb - ta;
      return (a.displayLabel ?? "").localeCompare(b.displayLabel ?? "");
    });

    let pool = sorted;

    const withCert: MarketplaceCollectionSummary[] = [];
    for (const c of sorted) {
      if (marketplaceSummaryHasPsaCertNumber(c.components as Record<string, unknown>)) {
        withCert.push(c);
      }
    }
    if (withCert.length > 0) {
      pool = withCert;
    }

    pool = pool.filter((c) =>
      collectionMatchesCategoryFilter(
        listingCategoryEffective,
        c,
        snapshotByKeyProp?.get(c.collectionKey.toLowerCase()),
      ),
    );

    return pool.slice(0, TRENDING_POOL);
  }, [
    collectionSummaries,
    listingCategoryEffective,
    snapshotByKeyProp,
  ]);

  const trendingSnapshotKeysSorted = useMemo(() => {
    const u = [...new Set(trendingNow.map((c) => c.collectionKey.toLowerCase()))];
    return u.sort();
  }, [trendingNow]);

  const fetchSnapshotsLocally = snapshotByKeyProp == null && trendingSnapshotKeysSorted.length > 0;

  const { data: snapshotPack } = useQuery({
    queryKey: rq.collectionSnapshots(trendingSnapshotKeysSorted, "max" as const),
    queryFn: () =>
      postMarketplaceCollectionSnapshotsBatched(trendingSnapshotKeysSorted, "max"),
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

  const trendingCarouselKeySig = useMemo(
    () => trendingNow.map((c) => c.collectionKey.toLowerCase()).join("|"),
    [trendingNow],
  );

  /** < sm (640px) — stack one card per view and advance on an interval */
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

  /** Desktop sliding window index (cycles with modulo). */
  const [deckWindowStart, setDeckWindowStart] = useState(0);
  /**
   * Mobile horizontal track index. When looping, slides are `…trendingNow` plus a duplicate
   * of the first card at the end; index === trendingCount shows that clone before snapping to 0.
   */
  const [narrowVisual, setNarrowVisual] = useState(0);
  const [narrowTransition, setNarrowTransition] = useState(true);

  /** Listing category / carousel pool change — avoid stale slide indices */
  useEffect(() => {
    setDeckWindowStart(0);
    setNarrowVisual(0);
  }, [listingCategoryEffective, trendingCarouselKeySig]);

  const narrowExtended = useMemo(() => {
    if (!narrowCarousel || !trendingLoops || trendingCount === 0) return trendingNow;
    const first = trendingNow[0];
    if (!first) return trendingNow;
    return [...trendingNow, first];
  }, [narrowCarousel, trendingLoops, trendingNow, trendingCount]);

  const deckWindowStartRef = useRef(deckWindowStart);
  deckWindowStartRef.current = deckWindowStart;
  const narrowVisualRef = useRef(narrowVisual);
  narrowVisualRef.current = narrowVisual;

  const suppressNavUntilRef = useRef(0);
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);
  const swipeAxisRef = useRef<"none" | "horizontal" | "vertical">("none");

  const prevNarrowRef = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    const prev = prevNarrowRef.current;
    prevNarrowRef.current = narrowCarousel;
    if (prev === undefined || trendingCount < 1) return;
    if (prev === narrowCarousel) return;
    if (narrowCarousel && !prev) {
      setNarrowVisual(deckWindowStartRef.current % trendingCount);
      return;
    }
    if (!narrowCarousel && prev) {
      const v = narrowVisualRef.current;
      setDeckWindowStart((v >= trendingCount ? 0 : v) % trendingCount);
    }
  }, [narrowCarousel, trendingCount]);

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
      out.push(trendingNow[(deckWindowStart + i) % n]!);
    }
    return out;
  }, [trendingNow, trendingCount, trendingLoops, deckWindowStart, maxVisible]);

  useEffect(() => {
    if (!trendingLoops || trendingPauseMotion) return;
    const id = window.setInterval(() => {
      if (narrowCarousel && trendingCount > 0) {
        setNarrowVisual((prev) =>
          prev >= trendingCount - 1 ? trendingCount : prev + 1,
        );
      } else {
        setDeckWindowStart((prev) => (prev + 1) % trendingCount);
      }
    }, CAROUSEL_AUTO_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [trendingLoops, trendingPauseMotion, narrowCarousel, trendingCount]);

  useEffect(() => {
    if (!narrowCarousel || !trendingLoops || narrowVisual !== trendingCount || trendingCount < 2) {
      return;
    }
    if (trendingPauseMotion) {
      setNarrowVisual(0);
      return;
    }
    const timer = window.setTimeout(() => {
      setNarrowTransition(false);
      setNarrowVisual(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setNarrowTransition(true));
      });
    }, CAROUSEL_SLIDE_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [narrowCarousel, trendingLoops, trendingPauseMotion, narrowVisual, trendingCount]);

  const scrollTrendingRef = useRef<(dir: "left" | "right") => void>(() => {});

  const scrollTrending = (dir: "left" | "right") => {
    if (narrowCarousel && trendingLoops && trendingCount > 0) {
      if (dir === "right") {
        setNarrowVisual((prev) => (prev >= trendingCount - 1 ? trendingCount : prev + 1));
      } else {
        setNarrowVisual((prev) => {
          if (prev <= 0) {
            queueMicrotask(() => {
              setNarrowTransition(false);
              setNarrowVisual(Math.max(trendingCount - 1, 0));
              requestAnimationFrame(() => {
                requestAnimationFrame(() => setNarrowTransition(true));
              });
            });
            return 0;
          }
          return prev - 1;
        });
      }
      return;
    }

    setDeckWindowStart((prev) => {
      const n = trendingCount;
      if (n <= maxVisible) return 0;
      if (dir === "left") return (prev - 1 + n) % n;
      return (prev + 1) % n;
    });
  };

  scrollTrendingRef.current = scrollTrending;

  const renderTrendingCard = (
    c: MarketplaceCollectionSummary,
    slideKeySuffix = "",
    narrowTrainSlideCount?: number,
  ) => {
    const s = snapshotByKey.get(c.collectionKey.toLowerCase());
    const comp = c.components as { gradeScore?: string };
    const eBayPrice = representativeGradeUsd(
      s?.gradePrices ?? null,
      parseGradeScoreNumber(comp.gradeScore),
      comp.gradeScore,
    );
    const changePctExternal =
      s?.marketChangePct != null && Number.isFinite(s.marketChangePct)
        ? s.marketChangePct
        : null;
    const changePeriodMeta = referenceChangePeriodFromSnapshotMeta(s);
    const changeWindowShort = formatReferenceChangePeriodFromSnapshotMeta(s);
    const changeCoverageHint = formatReferenceChangeCoverageHint(changePeriodMeta);
    const displayImageUrl = trendingCarouselImageUrl(c);
    return (
      <Link
        key={`${c.collectionKey}${slideKeySuffix}`}
        href={`/marketplace/collections/${encodeURIComponent(c.collectionKey)}`}
        className={`group block h-full w-full snap-start touch-pan-y ${
          narrowTrainSlideCount
            ? "min-w-0 shrink-0"
            : "min-w-full shrink-0 basis-full"
        }`}
        style={
          narrowTrainSlideCount
            ? { flex: `0 0 calc(100% / ${narrowTrainSlideCount})`, minWidth: 0 }
            : undefined
        }
        onClick={(e) => {
          if (Date.now() < suppressNavUntilRef.current) e.preventDefault();
        }}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl">
          <div className="aspect-[3/4] shrink-0 bg-[#0a0e14]">
            {displayImageUrl ? (
            <CollectionCoverFrame
              imageUrl={displayImageUrl}
              variant="flat"
              quietLoading
              className="h-full w-full"
            />
            ) : (
              <div className="h-full w-full bg-zinc-900" />
            )}
          </div>
          <div className="shrink-0 space-y-1 p-2.5 sm:p-3 min-h-[4.25rem] sm:min-h-[4rem]">
            <p className="line-clamp-2 min-h-[2.75rem] break-words text-base font-semibold uppercase leading-snug text-white sm:min-h-[1.75rem] sm:truncate sm:text-lg">
              {toCardDisplayUppercase(c.displayLabel)}
            </p>
            <div className="min-h-[1.35rem] sm:min-h-[1.5rem]">
              <ExchangeListingPriceWithChange
                priceUsd={eBayPrice}
                changePct={changePctExternal}
                windowShort={changeWindowShort}
                titleDetail={changeCoverageHint}
                align={variant === "landing" ? "start" : "end"}
                textClassName="text-base leading-none tabular-nums tracking-normal [font-family:var(--font-ibm-plex-sans),sans-serif] sm:text-[18px]"
                priceClassName="text-base font-bold leading-none tabular-nums tracking-normal text-white [font-family:var(--font-ibm-plex-sans),sans-serif] sm:text-[18px]"
                priceTitle="External eBay reference price."
              />
            </div>
          </div>
        </div>
      </Link>
    );
  };

  const isMarkets = variant === "markets";
  const showHeadingBlock = isMarkets && !hideTitle;
  /** Preserve carousel footprint on Markets when the listing category pool is empty — avoids layout jump. */
  const marketsCarouselReserveEmpty = isMarkets && trendingCount === 0;

  const landingNarrowW =
    variant === "landing" && narrowCarousel
      ? "max-w-[min(100%,29rem)]"
      : narrowCarousel
        ? "max-w-[min(100%,min(280px,100%))]"
        : "";

  const deckGridClass =
    variant === "landing" && narrowCarousel
      ? "grid grid-cols-1 max-w-[min(100%,29rem)] mx-auto gap-2 px-3 pb-0.5 pt-0"
      : narrowCarousel
        ? "grid grid-cols-1 max-w-[min(100%,min(280px,100%))] mx-auto gap-3 px-3 pb-2 pt-1 sm:px-10"
        : "grid grid-cols-1 gap-5 px-12 pb-2 pt-1 sm:grid-cols-2 xl:grid-cols-4";

  const narrowTrackSlide =
    narrowCarousel && trendingLoops && narrowExtended.length > 0;

  const resetSwipeGesture = () => {
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    swipeAxisRef.current = "none";
  };

  const onSwipePointerDown = (e: React.PointerEvent) => {
    if (!narrowTrackSlide || trendingPauseMotion) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    swipeStartXRef.current = e.clientX;
    swipeStartYRef.current = e.clientY;
    swipeAxisRef.current = "none";
  };

  const onSwipePointerMove = (e: React.PointerEvent) => {
    if (!narrowTrackSlide || trendingPauseMotion) return;
    const startX = swipeStartXRef.current;
    const startY = swipeStartYRef.current;
    if (startX == null || startY == null || swipeAxisRef.current !== "none") return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.hypot(dx, dy) < SWIPE_AXIS_LOCK_PX) return;

    if (Math.abs(dx) > Math.abs(dy) * 1.2) {
      swipeAxisRef.current = "horizontal";
    } else if (Math.abs(dy) > Math.abs(dx) * 1.2) {
      swipeAxisRef.current = "vertical";
    }
  };

  const onSwipePointerUp = (e: React.PointerEvent) => {
    if (!narrowTrackSlide || trendingPauseMotion) return;
    const startX = swipeStartXRef.current;
    const startY = swipeStartYRef.current;
    const axis = swipeAxisRef.current;
    resetSwipeGesture();
    if (startX == null || startY == null) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (axis === "vertical" || Math.abs(dy) > Math.abs(dx) * 1.2) return;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;

    suppressNavUntilRef.current = Date.now() + SWIPE_SUPPRESS_NAV_MS;
    if (dx < 0) scrollTrendingRef.current("right");
    else scrollTrendingRef.current("left");
  };

  const onSwipePointerCancel = () => {
    resetSwipeGesture();
  };

  /** Black circular control, mint chevrons — same on landing and Markets. */
  const carouselArrowMintEnabled =
    "border border-zinc-700/90 bg-black text-mint shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_4px_16px_rgba(0,0,0,0.55)] ring-1 ring-black/80 hover:border-mint/45 hover:bg-zinc-950 hover:text-mint active:opacity-85 motion-reduce:hover:border-zinc-700/90 motion-reduce:hover:bg-black";

  const carouselArrowOverlayClasses = (enabled: boolean) =>
    `absolute top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border text-2xl font-semibold leading-none transition-[transform,colors,box-shadow,opacity,border-color,background-color] motion-reduce:transition-none ${
      enabled
        ? carouselArrowMintEnabled
        : "cursor-not-allowed border-zinc-600/65 bg-zinc-950/80 text-zinc-500 opacity-60 shadow-[inset_0_1px_0_rgba(63,63,70,0.35)] backdrop-blur-sm ring-1 ring-black/25"
    }`;

  const carouselArrowRailClasses = (enabled: boolean) =>
    `shrink-0 flex h-11 w-11 items-center justify-center rounded-full border text-2xl font-semibold leading-none transition-[transform,colors,box-shadow,opacity,border-color] motion-reduce:transition-none ${
      enabled
        ? carouselArrowMintEnabled
        : "cursor-not-allowed border-zinc-700/65 bg-zinc-950/50 text-zinc-600 opacity-50 ring-1 ring-black/20"
    }`;

  const landingNarrowBleedRail =
    variant === "landing" && narrowTrackSlide
      ? "max-sm:-mx-2 max-sm:w-[calc(100%+1rem)] sm:w-full"
      : "";

  return (
    <section
      className={`${
        isMarkets
          ? showHeadingBlock
            ? "mb-10 mt-2 sm:mb-20 sm:mt-4"
            : "mb-8 mt-1 sm:mb-14 sm:mt-2"
          : "mx-auto mb-10 max-sm:mb-0 w-full max-w-6xl sm:mb-11"
      } ${!isMarkets ? "max-sm:min-h-0 max-sm:flex-1 max-sm:flex max-sm:flex-col" : ""} ${className}`.trim()}
      style={outerStyle}
      aria-label={
        isMarkets
          ? showHeadingBlock
            ? "Trending now collections"
            : "Collection carousel"
          : "Featured collections"
      }
    >
      {showHeadingBlock ? (
        <div className="mb-4 sm:mb-7">
          <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Trending Now
          </h2>
        </div>
      ) : null}

      <div
        className={`relative ${!isMarkets ? "max-sm:min-h-0 max-sm:flex-1 max-sm:flex max-sm:flex-col" : ""}`}
      >
        {!marketsCarouselReserveEmpty && !narrowTrackSlide ? (
          <>
            <button
              type="button"
              onClick={() => scrollTrending("left")}
              aria-label="Scroll collections left"
              disabled={
                !trendingLoops && deckWindowStart <= 0 && !(narrowCarousel && trendingCount > 1)
              }
              className={`left-0 ${carouselArrowOverlayClasses(
                trendingLoops ||
                  deckWindowStart > 0 ||
                  (narrowCarousel && trendingCount > 1),
              )}`}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => scrollTrending("right")}
              aria-label="Scroll collections right"
              disabled={
                !trendingLoops &&
                deckWindowStart >= maxTrendingStart &&
                !(narrowCarousel && trendingCount > 1)
              }
              className={`right-0 ${carouselArrowOverlayClasses(
                trendingLoops ||
                  deckWindowStart < maxTrendingStart ||
                  (narrowCarousel && trendingCount > 1),
              )}`}
            >
              ›
            </button>
          </>
        ) : null}

        {marketsCarouselReserveEmpty ? (
          <div className={deckGridClass}>
            <div
              className={`flex min-h-[20rem] flex-col items-center justify-center rounded-2xl border border-zinc-800/80 bg-[#0a0e14] px-4 py-10 text-center sm:min-h-[24rem] ${
                narrowCarousel ? "w-full" : "sm:col-span-2 xl:col-span-4"
              }`}
              role="status"
              aria-live="polite"
            >
              {collectionsPending ? (
                <div className="h-44 w-full max-w-[15rem] animate-pulse rounded-xl bg-zinc-800/55 sm:h-52 sm:max-w-xs" />
              ) : (
                <>
                  <p className="text-base font-semibold text-zinc-200 sm:text-lg">
                    {listingCategoryEffective !== "all"
                      ? "No listings in this category for the preview carousel."
                      : "No preview listings right now."}
                  </p>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
                    {listingCategoryEffective !== "all"
                      ? "Try ALL or another category — the trading list below may still have matches."
                      : "Check back soon, or browse the card trading list below."}
                  </p>
                </>
              )}
            </div>
          </div>
        ) : narrowTrackSlide ? (
          <div className={`flex w-full items-center gap-1.5 sm:gap-2 ${landingNarrowBleedRail}`}>
            <button
              type="button"
              onClick={() => scrollTrending("left")}
              aria-label="Scroll collections left"
              disabled={
                !trendingLoops && deckWindowStart <= 0 && !(narrowCarousel && trendingCount > 1)
              }
              className={carouselArrowRailClasses(
                trendingLoops ||
                  deckWindowStart > 0 ||
                  (narrowCarousel && trendingCount > 1),
              )}
            >
              ‹
            </button>
            <div
              role="presentation"
              className={`touch-pan-y isolate min-w-0 flex-1 overflow-x-clip pb-0.5 pt-0 ${
                variant === "landing" && narrowCarousel
                  ? "w-full max-w-none max-sm:ring-2 max-sm:ring-inset max-sm:ring-[#060708]"
                  : landingNarrowW
              }`}
              onPointerDown={onSwipePointerDown}
              onPointerMove={onSwipePointerMove}
              onPointerUp={onSwipePointerUp}
              onPointerCancel={onSwipePointerCancel}
            >
              <div
                className={`flex flex-row flex-nowrap items-stretch will-change-transform ${
                  narrowTransition && !trendingPauseMotion
                    ? "transition-transform duration-500 motion-reduce:transition-none motion-reduce:duration-0 [transition-timing-function:linear]"
                    : "!transition-none"
                }`}
                style={{
                  width: `calc(100% * ${narrowExtended.length})`,
                  transform: `translate3d(calc(-${narrowVisual} * 100% / ${narrowExtended.length}), 0, 0)`,
                }}
              >
                {narrowExtended.map((c, idx) =>
                  renderTrendingCard(
                    c,
                    idx === trendingCount ? `-dup` : "",
                    narrowExtended.length,
                  ),
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => scrollTrending("right")}
              aria-label="Scroll collections right"
              disabled={
                !trendingLoops &&
                deckWindowStart >= maxTrendingStart &&
                !(narrowCarousel && trendingCount > 1)
              }
              className={carouselArrowRailClasses(
                trendingLoops ||
                  deckWindowStart < maxTrendingStart ||
                  (narrowCarousel && trendingCount > 1),
              )}
            >
              ›
            </button>
          </div>
        ) : (
          <div className={deckGridClass}>{trendingVisible.map((c) => renderTrendingCard(c))}</div>
        )}
      </div>
    </section>
  );
}
