"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { Address } from "viem";
import { formatUnits } from "viem";
import {
  getCollectionMarketSeries,
  getCollectionPlatformTrades,
  getMarketplaceCollectionDetail,
  postRwaMetadataBatch,
  type Order,
  type RwaMetadata,
} from "@/lib/core";
import { pickCollectionHeroImageUrl } from "@/lib/marketplace";
import { COLLECTION_DETAIL_SHELL_CLASS } from "@/constants/layout";
import {
  computeCollectionMarketCapUsd,
  formatMarketCapUsd,
  marketHistoryTierFromComponents,
  marketTierDisplayLabel,
  parseGradeScoreNumber,
  percentChangeReferenceOver24h,
  resolveExternalMarketUsd,
} from "@/lib/market";
import { CollectionOverviewBoard } from "@/components/marketplace/CollectionOverviewBoard";
import { CollectionDetailsKvCard } from "@/components/marketplace/CollectionDetailsKvCard";
import { CollectionHeroDetailsTabs } from "@/components/marketplace/CollectionHeroDetailsTabs";
import type { CollectionDetailCard } from "@/components/marketplace/CollectionMetadataExpandable";
import { CollectionPriceMetricsStrip } from "@/components/marketplace/CollectionPriceMetricsStrip";
import type { BookRowSelection } from "@/components/marketplace/CollectionTradeTicket";
import { CollectionUnifiedOrderBook } from "@/components/marketplace/CollectionUnifiedOrderBook";
import {
  CollectionTradingTabs,
  type CollectionTradeTab,
} from "@/components/marketplace/CollectionTradingTabs";
import { CollectionOwnedRwaListModal } from "@/components/marketplace/CollectionOwnedRwaListModal";
import {
  TradeCelebrationModal,
  type TradeCelebrationKind,
} from "@/components/marketplace/TradeCelebrationModal";
import { CollectionDualPriceChart } from "@/components/marketplace/CollectionDualPriceChart";
import { CollectionRwaCard } from "@/components/marketplace/CollectionRwaCard";
import { useAppStore, selectWallet } from "@/store";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteria/criteriaMatch";
import {
  bucketCardNameForDisplay,
  bucketCardSetForDisplay,
  bucketGradingCompanyForDisplay,
} from "@/lib/marketplace/bucketKey";
import {
  buildCollectionHeadlineMetaStrip,
  computeCollectionWovenTitle,
  formatCollectionHeroCardTitle,
  leadingYearFromSetLine,
  toCardDisplayUppercase,
  yearFromComponents,
} from "@/lib/marketplace/collectionFullDetailsTitle";
import { buildCollectionHeadlineInfoTags, mergeHeadlineCardNumberIntoTitle, resolveHeadlineFormattedCardNumber } from "@/lib/marketplace/collectionHeadlineTags";
import { primeRwaMetadataCache } from "@/lib/marketplace";
import { COLLECTION_LISTING_CARD_CHROME } from "@/components/marketplace/collectionOverviewChrome";

/** Same fill can appear from session overlay + DB poll with timestamps minutes apart */
const SESSION_FILL_DEDUP_SEC = 300;

/** IPFS `metadata.name` persisted on `collection.components` at listing — matches in-grid RWA titles. */
function listingDisplayTitleFromComp(comp: Record<string, unknown>): string {
  const v = comp["listingDisplayTitle"];
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
}

type ChartRangeId = "7d" | "30d" | "90d" | "180d" | "1y";
type ChartRangeConfig = {
  id: ChartRangeId;
  label: string;
  historyPeriod: "7d" | "30d" | "90d" | "1y";
  maxDays: number;
  bundleDuration: "7d" | "30d" | "90d" | "180d" | "365d";
};
const CHART_RANGE_OPTIONS: readonly ChartRangeConfig[] = [
  { id: "7d", label: "7D", historyPeriod: "7d", maxDays: 7, bundleDuration: "7d" },
  { id: "30d", label: "30D", historyPeriod: "30d", maxDays: 30, bundleDuration: "30d" },
  { id: "90d", label: "90D", historyPeriod: "90d", maxDays: 90, bundleDuration: "90d" },
  { id: "180d", label: "180D", historyPeriod: "1y", maxDays: 180, bundleDuration: "180d" },
  { id: "1y", label: "1Y", historyPeriod: "1y", maxDays: 365, bundleDuration: "365d" },
] as const;

/** Clip Cardhedger curve to the selected range on the client (API still returns up to ~1y for parity with preview). */
const CHART_RANGE_CLIP_SEC = 86_400;

function CollectionDetailMobileNav() {
  return (
    <nav
      className="mb-3 flex min-h-[36px] items-center xl:hidden"
      aria-label="Back to markets"
    >
      <Link
        href="/markets"
        className="inline-flex items-center gap-1 rounded-md py-1 pr-2 text-[13px] font-medium text-zinc-400 transition-colors hover:text-white active:bg-white/[0.04]"
      >
        <svg
          className="h-4 w-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Markets
      </Link>
    </nav>
  );
}

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

/** Individual listing strip: oldest active ask first (not lowest token id). */
function sortedTokenIdsByOldestListing(asks: Order[]): number[] {
  const rows = asks.filter(
    (o) => String(o.side ?? "ask").toLowerCase() !== "bid",
  );
  rows.sort((a, b) => {
    const ta = new Date(a.createdAt ?? 0).getTime();
    const tb = new Date(b.createdAt ?? 0).getTime();
    if (ta !== tb) return ta - tb;
    return Number(a.tokenId) - Number(b.tokenId);
  });
  const seen = new Set<number>();
  const out: number[] = [];
  for (const o of rows) {
    const id = Number(o.tokenId);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Normalize bucket / Cardhedger raw tokens to a short language label (English UI). */
function displayEditionLanguage(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  if (/^(us|usa|north\s*america|english|eng|en)$/i.test(t)) return "English";
  if (/^(jp|japan|japanese|ja)$/i.test(t) || /日本|日本語|にほん/.test(t)) {
    return "Japanese";
  }
  if (/^(kr|korea|korean|ko)$/i.test(t) || /한국|한국어/.test(t)) {
    return "Korean";
  }
  if (/^(cn|china|chinese|zh)$/i.test(t) || /中文|简体|繁体/.test(t)) {
    return "Chinese";
  }
  return t;
}

/**
 * Guess print language from catalog copy only when we see actual JP/KR/CN script
 * or unambiguous CJK keywords — not Latin-only regional words alone.
 */
function inferLanguageFromCorpus(corpus: string): string | null {
  const c = corpus.trim();
  if (!c) return null;
  if (/日本|日本語|にほん/.test(c)) return "Japanese";
  if (/[\u3040-\u30ff]/.test(c)) return "Japanese";
  if (/한국|한국어/.test(c)) return "Korean";
  if (/[\uac00-\ud7af]/.test(c)) return "Korean";
  if (/中文|简体|繁体|简体中文版|繁體中文/.test(c)) return "Chinese";
  return null;
}

/**
 * Latin-only Pokémon catalog lines often spell region in English ("POKEMON CHINESE 25TH …",
 * "POKEMON JAPANESE SV2A …"). Only fire when the haystack looks like graded/TCG metadata.
 * `Pokemon Japanese` is skipped when copy names another regional SKU (e.g. Indonesian listings
 * that still carry global "Japanese" block catalog text).
 */
function inferLanguageFromLatinPokemonRegion(corpus: string): string | null {
  const c = corpus.trim();
  if (!c) return null;
  const h = c.toLowerCase().replace(/\s+/g, " ");

  const looksGradedOrTcg =
    /\bpokemon\b/i.test(c) ||
    /\btcgs?\b/i.test(c) ||
    /\bpsa\b/i.test(c) ||
    /\b(black\s*star|holo|promo|booster)\b/i.test(h);

  if (!looksGradedOrTcg) return null;

  if (/\bpokemon\s+chinese\b/i.test(c) || /\btcgs?\s+chinese\b/i.test(c)) return "Chinese";
  if (
    /\bchinese\s+(25th|24th|26th|27th|28th|29th|30th|\d{1,2}(?:st|nd|rd|th))\s+anniversary\b/i.test(
      h,
    ) ||
    /\bchinese\s+(classic|celebration)\s+collection\b/i.test(h) ||
    /\bchinese\s+(scarlet|violet|sun|moon|sword|shield|legends)\b/i.test(h) ||
    /\bchinese\s+(promo|collection|booster\s*box)\b/i.test(h)
  ) {
    return "Chinese";
  }

  if (/\bpokemon\s+korean\b/i.test(c) || /\btcgs?\s+korean\b/i.test(c)) return "Korean";

  const latinNamesNonJpRetail =
    /\bindonesia(?:n)?\b/i.test(c) ||
    /\bsingapore\b/i.test(h) ||
    /\bphilippines?\b/i.test(h) ||
    /\bthailand\b/i.test(h) ||
    /\bvietnam\b/i.test(h) ||
    /\bmalaysia\b/i.test(h);
  if (
    !latinNamesNonJpRetail &&
    (/\bpokemon\s+japanese\b/i.test(c) || /\btcgs?\s+japanese\b/i.test(c))
  ) {
    return "Japanese";
  }

  return null;
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
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [tradeCelebration, setTradeCelebration] = useState<TradeCelebrationKind | null>(null);
  const [bookSelection, setBookSelection] = useState<BookRowSelection | null>(null);
  const [chartRange, setChartRange] = useState<ChartRangeId>("90d");
  const [aiInsightComingSoonOpen, setAiInsightComingSoonOpen] = useState(false);
  /** Last fill this session (fixed timestamp) — merged into chart until series refetch includes it. */
  const [sessionFillPoint, setSessionFillPoint] = useState<{
    t: number;
    v: number;
  } | null>(null);
  const [showOrderBook, setShowOrderBook] = useState(false);
  const [tradeFlow, setTradeFlow] = useState<CollectionTradeTab>("buy");
  const [tradeDockOpen, setTradeDockOpen] = useState(false);

  useEffect(() => {
    if (!aiInsightComingSoonOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAiInsightComingSoonOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [aiInsightComingSoonOpen]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["marketplace-collection", key],
    queryFn: () => getMarketplaceCollectionDetail(key),
    enabled: key.length > 0,
    retry: false,
  });

  const comp = useMemo(() => {
    const raw = data?.collection?.components as
      | {
          cardName?: string;
          cardNameDisplay?: string;
          gradingCompany?: string;
          gradingCompanyDisplay?: string;
          gradeScore?: string;
          cardSet?: string;
          cardSetDisplay?: string;
          cardNumber?: string;
          variant?: string;
          psaTotalPopulation?: number;
        }
      | undefined;
    return raw ?? {};
  }, [data?.collection?.components]);

  const pokeHistoryTier = useMemo(
    () => marketHistoryTierFromComponents(comp as Record<string, unknown>),
    [comp],
  );

  const selectedChartRange = useMemo(
    () => CHART_RANGE_OPTIONS.find((x) => x.id === chartRange) ?? CHART_RANGE_OPTIONS[2],
    [chartRange],
  );

  const { data: marketSeriesHeader, isLoading: marketSeriesLoading } = useQuery({
    queryKey: ["collection-market-series", key, selectedChartRange.bundleDuration],
    queryFn: () => getCollectionMarketSeries(key, selectedChartRange.bundleDuration),
    enabled: key.length > 0 && !isLoading && !isError && !!data,
    staleTime: 120_000,
  });

  /** Single Cardhedger resolution: same object backs chart `externalUsd` and headline spot. */
  const marketPreview = marketSeriesHeader?.cardhedgerPreview ?? null;

  const jtHistPts = marketSeriesHeader?.externalUsd ?? [];
  const jtHistOk = jtHistPts.length >= 2;

  const chartExternalRollingUsd = useMemo(() => {
    const nowS = Math.floor(Date.now() / 1000);
    const cutoff = nowS - selectedChartRange.maxDays * CHART_RANGE_CLIP_SEC;
    if (!jtHistOk) return [];
    return jtHistPts.filter((p) => p.t >= cutoff);
  }, [jtHistOk, jtHistPts, selectedChartRange.maxDays]);

  const chartExternalWindowDays = useMemo(() => {
    if (!jtHistOk) return null;
    return selectedChartRange.maxDays;
  }, [jtHistOk, selectedChartRange.maxDays]);

  const pokeTierLabel = marketTierDisplayLabel(pokeHistoryTier);

  /** DB-only — chart points + Trades tab tape. */
  const { data: platformTradesData, isLoading: platformTradesLoading } = useQuery({
    queryKey: ["collection-platform-trades", key],
    queryFn: () => getCollectionPlatformTrades(key),
    enabled: key.length > 0,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });

  const platformPtsBase = useMemo(
    () => platformTradesData?.platformUsd ?? [],
    [platformTradesData?.platformUsd]
  );

  const displayPlatformUsd = useMemo(() => {
    const raw = platformPtsBase;
    const pts: { t: number; v: number }[] = [...raw];
    if (
      sessionFillPoint != null &&
      Number.isFinite(sessionFillPoint.v) &&
      sessionFillPoint.v > 0
    ) {
      const alreadyInSeries = pts.some(
        (p) =>
          Math.abs(p.v - sessionFillPoint.v) < 1e-4 &&
          Math.abs(p.t - sessionFillPoint.t) <= SESSION_FILL_DEDUP_SEC
      );
      if (!alreadyInSeries) pts.push(sessionFillPoint);
    }
    pts.sort((a, b) => a.t - b.t);
    const deduped: { t: number; v: number }[] = [];
    for (const p of pts) {
      if (deduped.length && deduped[deduped.length - 1].t === p.t) {
        deduped[deduped.length - 1] = p;
      } else {
        deduped.push(p);
      }
    }
    return deduped;
  }, [platformPtsBase, sessionFillPoint]);

  const liveMarketLegend = "Live market price";

  const chartExternalLegend = jtHistOk
    ? liveMarketLegend
    : `External market (${pokeTierLabel})`;

  const chartExternalShort = liveMarketLegend;

  const chartExternalRollingKind = jtHistOk ? "history" : "snapshot";

  const externalReferencePtsFor24h = useMemo(() => {
    if (jtHistOk) return jtHistPts;
    return [];
  }, [jtHistOk, jtHistPts]);

  const externalPriceChange24hPct = useMemo(
    () => percentChangeReferenceOver24h(externalReferencePtsFor24h),
    [externalReferencePtsFor24h],
  );

  const volume24hUsdc = useMemo(() => {
    const raw = platformTradesData?.trades;
    if (raw == null) return null;
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - 86400;
    let sum = 0;
    for (const row of raw) {
      if (row.t >= cutoff && Number.isFinite(row.priceUsdc) && row.priceUsdc > 0) {
        sum += row.priceUsdc;
      }
    }
    return sum;
  }, [platformTradesData?.trades]);

  const totalPopulation = useMemo(() => {
    const n = comp.psaTotalPopulation;
    if (n == null || !Number.isFinite(Number(n)) || Number(n) <= 0) return null;
    return Math.round(Number(n));
  }, [comp.psaTotalPopulation]);

  const orderBookTapeFills = useMemo(() => {
    const raw = platformTradesData?.trades ?? [];
    if (raw.length > 0) return raw;
    if (displayPlatformUsd.length === 0) return [];
    return [...displayPlatformUsd]
      .sort((a, b) => b.t - a.t)
      .slice(0, 80)
      .map((p, i) => ({
        t: p.t,
        priceUsdc: p.v,
        tokenId: "—",
        orderHash: `synthetic-${p.t}-${i}`,
        tapeAggressor: "buy" as const,
      }));
  }, [platformTradesData?.trades, displayPlatformUsd]);

  function invalidateCollection() {
    void queryClient.invalidateQueries({ queryKey: ["marketplace-collection", key] });
    void queryClient.invalidateQueries({ queryKey: ["collection-platform-trades", key] });
    void queryClient.invalidateQueries({ queryKey: ["collection-market-series", key] });
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

  const askMap = useMemo(() => bestAskByToken(asks), [asks]);
  const tokenIds = useMemo(
    () => (data ? sortedTokenIdsByOldestListing(asks) : []),
    [data, asks],
  );

  // Under-chart listing cards: all active asks. Metadata batch API allows max 80 ids per request.
  const { data: batchMetadata } = useQuery({
    queryKey: ["collection-listings-metadata", key, tokenIds],
    queryFn: async () => {
      const ids = tokenIds;
      const BATCH_MAX = 80;
      const chunks: number[][] = [];
      for (let i = 0; i < ids.length; i += BATCH_MAX) {
        chunks.push(ids.slice(i, i + BATCH_MAX));
      }
      const packs = await Promise.all(
        chunks.map((chunk) => postRwaMetadataBatch({ tokenIds: chunk })),
      );
      const flat = packs.flatMap((p) => p.items);
      primeRwaMetadataCache(
        flat.map((it) => ({
          tokenId: it.tokenId,
          metadata: it.metadata,
          imageUrl: it.imageUrl,
        })),
      );
      return new Map(
        flat.map((it) => [
          it.tokenId,
          { metadata: it.metadata as RwaMetadata | null, imageUrl: it.imageUrl },
        ]),
      );
    },
    enabled: tokenIds.length > 0,
    staleTime: 60_000,
  });

  const resolvedExternal = useMemo(
    () =>
      resolveExternalMarketUsd({
        marketPreview,
        gradePrices: marketSeriesHeader?.gradePrices ?? null,
        gradeScore: parseGradeScoreNumber(comp.gradeScore),
        components: comp as Record<string, unknown>,
      }),
    [
      marketPreview,
      marketSeriesHeader?.gradePrices,
      comp.gradeScore,
      comp,
    ],
  );

  const chartExternalRefTag =
    resolvedExternal.source === "cardhedger"
      ? liveMarketLegend
      : `External ${pokeTierLabel}`;

  const marketCapComputation = useMemo(
    () =>
      data?.collection
        ? computeCollectionMarketCapUsd({
            components: data.collection.components as Record<string, unknown>,
            gradeScoreStr: comp.gradeScore,
            marketCard: marketPreview?.card ?? null,
            marketMatchConfidence: marketPreview?.matchConfidence,
            gradePrices: marketSeriesHeader?.gradePrices ?? null,
            marketPreview: marketPreview ?? null,
          })
        : null,
    [
      data?.collection,
      comp.gradeScore,
      marketPreview,
      marketSeriesHeader?.gradePrices,
    ],
  );

  /** Primary card facts: hero title, set line, badges, and `headlineInfoTags` chips. */
  const metadataRows = useMemo(() => [] as { label: string; value: string }[], [key]);

  const subtitle = useMemo(() => {
    const setShown = bucketCardSetForDisplay(comp as Record<string, unknown>);
    const parts = [setShown, comp.cardNumber].filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0
    );
    if (!parts.length) return null;
    return toCardDisplayUppercase(parts.join(" · "));
  }, [comp, data?.collection?.components]);

  const headlineSetLine = useMemo(() => {
    const bucketSet = bucketCardSetForDisplay(comp as Record<string, unknown>).trim();
    const listingTitle = listingDisplayTitleFromComp(comp as Record<string, unknown>);
    const setMerged =
      listingTitle.length > 0
        ? bucketSet ||
          marketPreview?.card?.setName?.trim() ||
          ""
        : marketPreview?.card?.setName?.trim() || bucketSet;
    if (!setMerged.length) return null;
    const yFromSet = leadingYearFromSetLine(setMerged);
    const yComp = yearFromComponents(comp as Record<string, unknown>);
    const y = yFromSet ?? yComp;
    const line =
      y != null && !/^\s*\d{4}\b/.test(setMerged) ? `${y} ${setMerged}` : setMerged;
    return toCardDisplayUppercase(line);
  }, [marketPreview?.card?.setName, comp]);

  const collectionCategoryBadge = useMemo(() => {
    const name = bucketCardNameForDisplay(comp as Record<string, unknown>);
    const setN = bucketCardSetForDisplay(comp as Record<string, unknown>);
    const listingTitle = listingDisplayTitleFromComp(comp as Record<string, unknown>);
    const corpus = `${listingTitle} ${name} ${setN} ${marketPreview?.card?.setName ?? ""}`;
    if (/\bpokemon\b/i.test(corpus)) return toCardDisplayUppercase("Pokemon");
    const cat = marketPreview?.card?.category?.trim();
    if (cat) {
      const t = cat.replace(/\s+/g, " ");
      return toCardDisplayUppercase(t);
    }
    return toCardDisplayUppercase("Trading cards");
  }, [
    marketPreview?.card?.category,
    marketPreview?.card?.setName,
    comp.cardNameDisplay,
    comp.cardName,
    comp.cardSet,
    comp.cardSetDisplay,
  ]);

  const collectionHeadlineCardName = useMemo(() => {
    const listingTitle = listingDisplayTitleFromComp(comp as Record<string, unknown>);
    if (listingTitle.length > 0) return toCardDisplayUppercase(listingTitle);
    const nm = bucketCardNameForDisplay(comp as Record<string, unknown>).trim();
    const dl =
      typeof data?.collection?.displayLabel === "string"
        ? data.collection.displayLabel.trim()
        : "";
    if (nm.length > 0)
      return toCardDisplayUppercase(formatCollectionHeroCardTitle(comp as Record<string, unknown>));
    if (dl.length > 0) return toCardDisplayUppercase(dl);
    return toCardDisplayUppercase(
      key.length > 0 ? key.slice(0, 18) + (key.length > 18 ? "…" : "") : "Collection",
    );
  }, [
    comp,
    comp.cardNameDisplay,
    comp.cardName,
    data?.collection?.displayLabel,
    key,
  ]);

  const headlineCardNumberToken = useMemo(
    () =>
      resolveHeadlineFormattedCardNumber(
        marketPreview ?? null,
        comp as Record<string, unknown>,
      ),
    [marketPreview, comp],
  );

  const collectionHeadlineDisplayTitle = useMemo(
    () =>
      toCardDisplayUppercase(
        mergeHeadlineCardNumberIntoTitle(collectionHeadlineCardName, headlineCardNumberToken),
      ),
    [collectionHeadlineCardName, headlineCardNumberToken],
  );

  const collectionHeadlineMetaStrip = useMemo(() => {
    const raw = buildCollectionHeadlineMetaStrip({
      setLine: headlineSetLine,
      comp: comp as Record<string, unknown>,
      marketPreview: marketPreview ?? null,
      displayLabel:
        typeof data?.collection?.displayLabel === "string"
          ? data.collection.displayLabel.trim()
          : null,
    });
    if (raw == null || !String(raw).trim()) return null;
    return toCardDisplayUppercase(raw);
  }, [headlineSetLine, comp, marketPreview, data?.collection?.displayLabel]);

  const headlineGradeBadge = useMemo(
    () => (pokeTierLabel ? toCardDisplayUppercase(pokeTierLabel) : null),
    [pokeTierLabel],
  );

  const collectionPopulationBadge = useMemo(() => {
    const popRaw = comp.psaTotalPopulation;
    if (popRaw == null || !Number.isFinite(popRaw) || popRaw <= 0) return null;
    const n = Number(popRaw);
    return toCardDisplayUppercase(`Pop · ${n.toLocaleString("en-US")}`);
  }, [comp.psaTotalPopulation]);

  const collectionWovenTitle = useMemo(() => {
    return toCardDisplayUppercase(
      computeCollectionWovenTitle(
        collectionHeadlineDisplayTitle,
        headlineSetLine,
        collectionHeadlineMetaStrip,
        headlineCardNumberToken,
        null,
      ),
    );
  }, [
    collectionHeadlineDisplayTitle,
    headlineSetLine,
    collectionHeadlineMetaStrip,
    headlineCardNumberToken,
  ]);

  const headlineInfoTags = useMemo(() => {
    const raw = buildCollectionHeadlineInfoTags({
      headlineSetLine,
      comp: comp as Record<string, unknown>,
      marketPreview: marketPreview ?? null,
      collectionHeadlineTitle: collectionHeadlineDisplayTitle,
      collectionHeadlineMetaStrip,
      pokeTierLabel,
    });
    if (!raw) return null;
    return raw.map((t) => ({
      ...t,
      text: toCardDisplayUppercase(t.text),
      title: t.title ? toCardDisplayUppercase(t.title) : undefined,
    }));
  }, [
    headlineSetLine,
    collectionHeadlineDisplayTitle,
    collectionHeadlineMetaStrip,
    marketPreview,
    pokeTierLabel,
    comp,
  ]);

  /** Latest on-platform sale (DB poll or initial bundle). */
  const lastPlatformSaleUsdc = useMemo(() => {
    const pts = platformPtsBase;
    if (!pts.length) return null;
    const last = pts[pts.length - 1];
    return typeof last.v === "number" && Number.isFinite(last.v) && last.v > 0 ? last.v : null;
  }, [platformPtsBase]);

  const orderBookLastSaleUsdc = sessionFillPoint?.v ?? lastPlatformSaleUsdc;

  useEffect(() => {
    setSessionFillPoint(null);
  }, [key]);

  /** Clear session overlay once DB poll includes this fill (timestamps often differ by more than a few seconds). */
  useEffect(() => {
    if (!sessionFillPoint || !platformPtsBase.length) return;
    const found = platformPtsBase.some(
      (p) =>
        Math.abs(p.v - sessionFillPoint.v) < 1e-4 &&
        Math.abs(p.t - sessionFillPoint.t) <= SESSION_FILL_DEDUP_SEC
    );
    if (found) setSessionFillPoint(null);
  }, [platformPtsBase, sessionFillPoint]);

  /** Details tiles under the hero (label + value only). */
  const collectionMarketDetailCards = useMemo((): CollectionDetailCard[] => {
    if (!key.trim() || !data?.collection) return [];
    const ch = marketPreview?.card ?? null;

    const rows: CollectionDetailCard[] = [];

    const cardNumRaw =
      headlineCardNumberToken?.trim() ||
      (typeof comp.cardNumber === "string" && comp.cardNumber.trim()
        ? comp.cardNumber.trim()
        : "");
    if (cardNumRaw) {
      rows.push({
        id: "card-number",
        label: "Card Number",
        value: headlineCardNumberToken?.trim() || cardNumRaw,
      });
    }

    const variantStr =
      (typeof comp.variant === "string" && comp.variant.trim()
        ? comp.variant.trim()
        : "") || (marketPreview?.card?.variant?.trim() ?? "");
    if (variantStr) {
      rows.push({
        id: "variant",
        label: "Variant",
        value: variantStr,
      });
    }

    const cat = collectionCategoryBadge?.trim();
    if (cat) {
      rows.push({
        id: "category",
        label: "Category",
        value: cat,
      });
    }

    const gradeStr = typeof comp.gradeScore === "string" ? comp.gradeScore.trim() : "";
    if (gradeStr) {
      rows.push({
        id: "grade",
        label: "Grade",
        value: gradeStr,
      });
    }

    const grader = bucketGradingCompanyForDisplay(comp as Record<string, unknown>).trim();
    if (grader) {
      rows.push({
        id: "grader",
        label: "Grader",
        value: grader,
      });
    }

    const setName =
      headlineSetLine?.trim() || bucketCardSetForDisplay(comp as Record<string, unknown>).trim();
    if (setName) {
      rows.push({
        id: "set",
        label: "Set",
        value: setName,
      });
    }

    const yrFromComp = yearFromComponents(comp as Record<string, unknown>);
    let yr: number | null = yrFromComp;
    if (yr == null) {
      const listingLineEarly = listingDisplayTitleFromComp(comp as Record<string, unknown>);
      const setCandidates = [
        listingLineEarly,
        headlineSetLine?.trim(),
        ch?.setName?.trim(),
        bucketCardSetForDisplay(comp as Record<string, unknown>).trim(),
      ];
      for (const s of setCandidates) {
        if (!s) continue;
        const y = leadingYearFromSetLine(s);
        if (y != null) {
          yr = y;
          break;
        }
      }
    }
    if (yr != null) {
      rows.push({
        id: "year",
        label: "Year",
        value: String(yr),
      });
    }

    const compRec = comp as Record<string, unknown>;
    const listingLine = listingDisplayTitleFromComp(compRec);
    const fromComp =
      typeof compRec.language === "string" && compRec.language.trim()
        ? compRec.language.trim()
        : null;
    const fromMarket = ch?.market?.trim() ?? null;

    const corpus = [
      listingLine,
      headlineSetLine,
      ch?.setName,
      ch?.name,
      bucketCardSetForDisplay(comp as Record<string, unknown>),
    ]
      .filter((x): x is string => typeof x === "string" && Boolean(x.trim()))
      .join(" ");

    let lang: string | null = null;
    if (fromComp) lang = displayEditionLanguage(fromComp) ?? fromComp;
    if (!lang && fromMarket) lang = displayEditionLanguage(fromMarket) ?? fromMarket;
    if (!lang) lang = inferLanguageFromCorpus(corpus);
    if (!lang) lang = inferLanguageFromLatinPokemonRegion(corpus);
    /** English edition: Cardhedger match but no region field and no JP/KR/CN signals in copy. */
    if (!lang && ch != null && !/[\u3000-\u9fff\uac00-\ud7af]/.test(corpus)) {
      lang = "English";
    }
    if (
      lang === "English" &&
      /\bindonesia(?:n)?\b/i.test(corpus)
    ) {
      lang = "English · Indonesian (card)";
    }
    if (lang) {
      rows.push({
        id: "language",
        label: "Language",
        value: lang,
      });
    }

    return rows.map((row) => ({
      ...row,
      value: toCardDisplayUppercase(row.value),
    }));
  }, [
    key,
    data?.collection,
    marketPreview?.card,
    comp,
    headlineCardNumberToken,
    headlineSetLine,
    collectionCategoryBadge,
  ]);

  const detailsCatalogLine = useMemo(() => {
    const fromTags = headlineInfoTags?.find((t) => t.id === "cardno")?.text?.trim();
    if (fromTags) return fromTags;
    const raw = headlineCardNumberToken?.trim();
    if (!raw) return null;
    return raw.startsWith("#") ? raw : `#${raw}`;
  }, [headlineInfoTags, headlineCardNumberToken]);

  const heroDetailsKvRows = useMemo((): CollectionDetailCard[] => {
    const player = collectionHeadlineCardName?.trim();
    const priority = [
      "card-number",
      "variant",
      "set",
      "category",
      "grade",
      "grader",
      "year",
      "language",
    ] as const;
    const byId = new Map(collectionMarketDetailCards.map((c) => [c.id, c]));
    const out: CollectionDetailCard[] = [];
    if (player) {
      out.push({
        id: "player",
        label: "Player",
        value: toCardDisplayUppercase(player),
      });
    }
    for (const id of priority) {
      const row = byId.get(id);
      if (row) out.push(row);
    }
    for (const row of collectionMarketDetailCards) {
      if (!out.some((r) => r.id === row.id)) {
        out.push(row);
      }
    }
    return out;
  }, [collectionMarketDetailCards, collectionHeadlineCardName]);

  const presetPriceFromBook = useMemo(() => {
    if (bookSelection == null) return null;
    return bookSelection.price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [bookSelection]);

  const listPricePresetUsdc = useMemo(() => {
    if (bookSelection?.side !== "bid") return null;
    return presetPriceFromBook;
  }, [bookSelection, presetPriceFromBook]);

  /** First bid order at the selected depth — drives list-then-match priority (same price, multiple bids). */
  const preferredBidOrderHash = useMemo(() => {
    if (bookSelection?.side !== "bid" || !bookSelection.orders.length) return null;
    return bookSelection.orders[0]?.orderHash ?? null;
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
      <div className="min-h-screen bg-[rgba(11,13,16,1)] text-white">
        <div
          className={`${COLLECTION_DETAIL_SHELL_CLASS} py-4 sm:py-8 pb-[max(5.5rem,env(safe-area-inset-bottom,0px)+4.5rem)] sm:pb-20`}
        >
          <CollectionDetailMobileNav />
          <div className="h-4 w-40 bg-gray-800/80 rounded animate-pulse mb-6" />
          <div className="rounded-2xl border border-gray-800/90 bg-[#0b0e11] overflow-hidden animate-pulse mb-10">
            <div className="border-b border-gray-800/80 px-4 py-4 sm:px-6">
              <div className="h-10 w-48 rounded-md bg-gray-800/50" />
            </div>
            <div className="grid gap-6 p-6 lg:grid-cols-[minmax(260px,min(307px,40vw))_minmax(0,1fr)_minmax(300px,420px)]">
              <div className="flex justify-center">
                <div className="aspect-[3/4] w-full max-w-[253px] sm:max-w-[280px] lg:max-w-[307px] rounded-2xl bg-gray-800/60" />
              </div>
              <div className="space-y-4 min-w-0">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(260px,304px)] gap-3">
                  <div className="h-52 min-h-[186px] lg:h-[17rem] lg:min-h-[210px] rounded-xl bg-gray-800/40" />
                  <div className="h-52 min-h-[186px] lg:h-[17rem] lg:min-h-[210px] rounded-xl bg-gray-800/35 border border-gray-800/80" />
                </div>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-900/40 min-h-[260px]" />
            </div>
          </div>
          <div className="flex gap-4 overflow-hidden">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-52 w-[200px] shrink-0 rounded-2xl bg-gray-800/40 border border-gray-800/80"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data || !data.collection) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <p className="text-red-400 text-sm mb-4">
          {isError && error instanceof Error
            ? error.message
            : "Collection not found (no summary row for this bucket yet). List an NFT in this bucket or open it from the markets after the first listing."}
        </p>
      </div>
    );
  }

  const collection = data.collection;
  const collectionCoverUrl = pickCollectionHeroImageUrl(data);

  const exchangePriceStripProps = {
    showFootnotes: false as const,
    compact: true,
    exchangeUnifiedRow: true as const,
    externalMarketUsd: resolvedExternal.usd,
    externalPriceSource: resolvedExternal.source,
    marketTierDisplay: pokeTierLabel,
    externalMarketMatchConfidence: resolvedExternal.marketMatchConfidence,
    externalPriceLoading: marketSeriesLoading,
    externalPriceChange24hPct,
    externalPriceChange24hLoading: marketSeriesLoading,
    volume24hUsdc,
    volume24hLoading: platformTradesLoading,
    totalPopulation,
    marketCapUsd: marketCapComputation?.usd ?? null,
    marketCapMethodHint: marketCapComputation?.methodLabel ?? null,
    formatMarketCap: formatMarketCapUsd,
  };

  return (
    <div className="min-h-screen bg-[rgba(11,13,16,1)] text-white">
      <div
        className={`${COLLECTION_DETAIL_SHELL_CLASS} py-4 sm:py-8 pb-[max(5.5rem,env(safe-area-inset-bottom,0px)+4.5rem)] sm:pb-20`}
      >
        <CollectionDetailMobileNav />
        <CollectionOverviewBoard
          title={collectionWovenTitle}
          subtitle={subtitle}
          headlineTitle={collectionHeadlineDisplayTitle}
          headlineSetLine={headlineSetLine}
          headlineMetaStrip={collectionHeadlineMetaStrip ?? undefined}
          headlineInfoTags={headlineInfoTags ?? undefined}
          categoryBadge={collectionCategoryBadge}
          gradeBadge={headlineGradeBadge ?? undefined}
          populationBadge={collectionPopulationBadge ?? undefined}
          headlineTitleLayout
          badgeLabel="Collection"
          imageUrl={collectionCoverUrl}
          belowCover={
            <CollectionHeroDetailsTabs
              onAiInsightsClick={() => setAiInsightComingSoonOpen(true)}
              detailsPanel={
                <CollectionDetailsKvCard
                  title={collectionHeadlineCardName}
                  subtitle={headlineSetLine}
                  catalogLine={detailsCatalogLine}
                  rows={heroDetailsKvRows}
                  compactRows={heroDetailsKvRows.filter((r) => r.id !== "player")}
                  compact
                />
              }
            />
          }
          metadataRows={metadataRows}
          stats={[]}
          chartMetricsRow={
            <CollectionPriceMetricsStrip {...exchangePriceStripProps} />
          }
          bookColumnMetricsRow={null}
          showOrderBook={showOrderBook}
          onShowOrderBookChange={setShowOrderBook}
          exchangeDockTradePanel
          listingCount={asks.length}
          showListingSummary={false}
          priceChart={
            <CollectionDualPriceChart
              variant="exchange"
              collectionOverviewMat
              chartTitle=""
              platformUsd={displayPlatformUsd}
              externalMarketUsd={
                chartExternalRollingUsd.length >= 2 ? null : resolvedExternal.usd
              }
              externalWindowDays={chartExternalWindowDays}
              externalRollingUsd={
                chartExternalRollingUsd.length > 0 ? chartExternalRollingUsd : null
              }
              externalRollingKind={chartExternalRollingKind}
              externalLegendLabel={chartExternalLegend}
              externalSeriesShortLabel={chartExternalShort}
              externalRefLineTag={chartExternalRefTag}
              isLoading={
                platformTradesLoading || marketSeriesLoading
              }
              errorMessage={null}
              controls={
                <div className="flex w-full min-w-0 max-xl:gap-0.5 max-xl:rounded-lg max-xl:border max-xl:border-[rgba(38,39,45,1)] max-xl:bg-black/30 max-xl:p-0.5 xl:flex-wrap xl:items-center xl:justify-between xl:gap-1">
                  {CHART_RANGE_OPTIONS.map((opt) => {
                    const active = opt.id === chartRange;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setChartRange(opt.id)}
                        className={`font-semibold transition-colors max-xl:flex-1 max-xl:rounded-md max-xl:px-1 max-xl:py-2 max-xl:text-center max-xl:text-[11px] xl:rounded-md xl:px-2.5 xl:py-1 xl:text-[11px] ${
                          active
                            ? "bg-mint text-black"
                            : "text-zinc-400 hover:text-zinc-100"
                        }`}
                        aria-pressed={active}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              }
            />
          }
          orderBookNextToChart={
            <CollectionUnifiedOrderBook
              collectionKey={collection.collectionKey}
              asks={asks}
              collectionBids={collectionBids}
              onSelectLevel={(sel) => {
                setBookSelection(sel);
                setTradeFlow("buy");
                setTradeDockOpen(true);
              }}
              selectedLevelKey={bookSelection?.levelKey ?? null}
              compact
              lastTradePriceUsdc={orderBookLastSaleUsdc}
              lastTradeSide="buy"
              tapeFills={orderBookTapeFills}
              tapeLoading={platformTradesLoading}
            />
          }
          tradePanel={
            <CollectionTradingTabs
              bookSelection={bookSelection}
              address={address as Address | undefined}
              onBuySuccess={() => {
                setSellModalOpen(false);
                setTradeCelebration("purchase");
                void invalidateCollection();
              }}
              onOpenSellModal={() => setSellModalOpen(true)}
              collectionKey={collection.collectionKey}
              collectionLabel={toCardDisplayUppercase(collection.displayLabel)}
              asks={asks}
              collectionBids={collectionBids}
              connectedAddress={address ?? undefined}
              onInvalidate={invalidateCollection}
              onInstantBuyFillUsdc={(usdc) =>
                setSessionFillPoint({ t: Math.floor(Date.now() / 1000), v: usdc })
              }
              onPurchaseFilled={() => {
                setSellModalOpen(false);
                setTradeCelebration("purchase");
              }}
              presetPriceFromBook={presetPriceFromBook}
              listingCount={asks.length}
              showSellListingCount={false}
              tradeFlow={tradeFlow}
              onTradeFlowChange={setTradeFlow}
              exchangeDock
              dockOpen={tradeDockOpen}
              onDockOpenChange={setTradeDockOpen}
            />
          }
          exchangeBelowChart={
            tokenIds.length === 0 ? (
              <div
                className={`w-full max-w-full px-4 py-8 text-center text-[15px] leading-relaxed text-[#a0a0a0] ${COLLECTION_LISTING_CARD_CHROME}`}
              >
                No listings yet. List an asset from{" "}
                <Link href="/portfolio" className="text-mint hover:underline">
                  My Assets
                </Link>
                .
              </div>
            ) : (
              <div className="grid w-full min-w-0 max-w-full grid-cols-2 content-start items-stretch justify-items-stretch gap-2 max-xl:gap-2.5 max-xl:pb-2 xl:flex xl:flex-row xl:flex-wrap xl:gap-x-[0.875rem] xl:gap-y-[0.9rem] xl:pb-2">
                {tokenIds.map((tid) => {
                  const prefetch = batchMetadata?.get(tid);
                  return (
                    <div
                      key={tid}
                      className="flex min-h-0 min-w-0 w-full xl:w-[218px] xl:shrink-0 lg:w-[234px]"
                    >
                      <CollectionRwaCard
                        tokenId={tid}
                        collectionKey={key}
                        listing={askMap.get(tid) ?? null}
                        address={address}
                        prefetchedImageUrl={prefetch?.imageUrl}
                        prefetchedMetadata={prefetch?.metadata}
                      />
                    </div>
                  );
                })}
              </div>
            )
          }
        />

      </div>

      <TradeCelebrationModal
        open={tradeCelebration != null}
        kind={tradeCelebration ?? "purchase"}
        onClose={() => setTradeCelebration(null)}
      />

      {aiInsightComingSoonOpen ? (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-insight-coming-soon-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/75 backdrop-blur-[1px]"
            aria-label="Close"
            onClick={() => setAiInsightComingSoonOpen(false)}
          />
          <div
            className="relative z-10 w-full max-w-[min(100%,20rem)] rounded-2xl border border-zinc-600/70 bg-[#161616] px-5 py-6 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.06]"
          >
            <h2 id="ai-insight-coming-soon-title" className="text-lg font-semibold tracking-tight text-white">
              AI Insights
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
              This feature isn&apos;t available yet. We&apos;re preparing it for a future release.
            </p>
            <button
              type="button"
              onClick={() => setAiInsightComingSoonOpen(false)}
              className="mt-6 w-full rounded-xl bg-zinc-100 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}

      <CollectionOwnedRwaListModal
        open={sellModalOpen}
        onClose={() => setSellModalOpen(false)}
        collectionKey={collection.collectionKey}
        collectionLabel={toCardDisplayUppercase(collection.displayLabel)}
        collectionBids={collectionBids}
        listPricePresetUsdc={listPricePresetUsdc}
        preferredBidOrderHash={preferredBidOrderHash}
        onSaleCelebration={() => setTradeCelebration("sale")}
      />
    </div>
  );
}
