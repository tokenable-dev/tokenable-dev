"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useReadContract } from "wagmi";
import { sepolia } from "@/config/wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import {
  getActiveOrderForToken,
  getCollectionMarketSeries,
  getCollectionMarketStats,
  getCollectionMarketPriceHistory,
  getOrderHistoryByTokenId,
  getResolvedRwaAsset,
  getMarketplaceCollectionDetailOrNull,
  postBatchMintMarketPreviews,
  type Order,
} from "@/lib/core";
import {
  coefficientOfVariationPctFromUsdSeries,
  percentChangeFromUsdPoints,
  resolveExternalMarketUsd,
} from "@/lib/market";
import { parseGradeScoreNumber } from "@/lib/market";
import {
  marketHistoryTierFromComponents,
  marketTierDisplayLabel,
} from "@/lib/market";
import {
  CHART_EXTERNAL_HISTORY,
  CHART_EXTERNAL_HISTORY_DAYS,
} from "@/components/marketplace/chartTimeRange";
import { CollectionPriceMetricsStrip } from "@/components/marketplace/CollectionPriceMetricsStrip";
import { GradedMetadataPanel } from "@/components/common";
import {
  RwaDetailAssetPanel,
  type RwaDetailMetadata,
} from "@/components/marketplace/RwaDetailAssetPanel";
import {
  TOKENABLE_RWA_ADDRESS,
  TOKENABLE_RWA_DISPLAY_NAME,
  TOKENABLE_RWA_READ_ABI,
  SEAPORT_ADDRESS,
} from "@/constants/contracts";
import {
  TradeCelebrationModal,
  type TradeCelebrationKind,
} from "@/components/marketplace/TradeCelebrationModal";

/** Huge modal (Seaport/wagmi) — load only when opened to shrink initial `[tokenId]` compile + main-thread work */
const ListRwaModal = dynamic(
  () =>
    import("@/components/marketplace/ListRwaModal").then((m) => ({
      default: m.ListRwaModal,
    })),
  { ssr: false },
);
import { CollectionMarketPanel } from "@/components/marketplace/CollectionMarketPanel";
import {
  computeMarketBucketKey,
  extractBucketComponentsFromMetadata,
} from "@/lib/marketplace/bucketKey";
import { useAppStore, selectWallet } from "@/store";
import type { GradedCardMetadata } from "@/types/gradedCard";

// ─── Activity history (DB 기반) ───────────────────────────────────────────────

function useActivityHistory(tokenId: number, enabled: boolean) {
  return useQuery({
    queryKey: ["rwa-activity", tokenId],
    queryFn: () => getOrderHistoryByTokenId(tokenId),
    enabled,
    staleTime: 15_000,
    retry: 1,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortAddr(addr?: string) {
  if (!addr) return "—";
  const a = addr.startsWith("0x") ? addr : `0x${addr}`;
  if (a.length <= 14) return a;
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

/** 긴 숫자형 Token ID를 중간 말줄임 (예: 110660…7983) */
function formatTokenIdDisplay(id: number): string {
  if (!Number.isFinite(id)) return "—";
  const s = String(Math.trunc(id));
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

/**
 * API/DB는 UTC인데 `Z` 없이 오면 `new Date(str)`이 로컬(예: 한국)로 해석되어
 * 약 9시간 어긋날 수 있음 → 오프셋 없으면 UTC로 고정.
 */
function parseApiUtcMs(raw: string | undefined | null): number {
  if (raw == null || raw === "") return 0;
  let s = String(raw).trim();
  const hasOffset =
    /Z$/i.test(s) ||
    /[+-]\d{2}:\d{2}$/.test(s) ||
    /[+-]\d{4}$/.test(s);
  if (hasOffset) {
    const t = new Date(s).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  s = s.includes("T") ? s : s.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    const t = new Date(`${s}Z`).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : 0;
}

function timeAgo(ts?: number): string {
  if (ts == null || !Number.isFinite(ts) || ts <= 0) return "";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60)
    return `${diff} second${diff === 1 ? "" : "s"} ago`;
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  const d = Math.floor(diff / 86400);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

const SEPOLIA_ETHERSCAN = "https://sepolia.etherscan.io";

function explorerAddrPath(addr: string): string {
  return `${SEPOLIA_ETHERSCAN}/address/${addr}`;
}

/** Seaport consideration 중 offerer가 아닌 수령인(수수료·구매자 힌트 등) */
function firstNonOffererRecipient(order: Order): string | undefined {
  const o = order.offerer.toLowerCase();
  for (const c of order.parameters.consideration ?? []) {
    const r = c.recipient?.toLowerCase();
    if (r && r !== o) return c.recipient;
  }
  return undefined;
}

function IconExternalLink({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function IconTag({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RwaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenId = Number(params.tokenId);

  const { address, isConnected } = useAppStore(useShallow(selectWallet));

  const queryClient = useQueryClient();

  const [detailsExtraOpen, setDetailsExtraOpen] = useState(false);
  const [listModalOpen, setListModalOpen] = useState(false);
  const [listModalInitialPrice, setListModalInitialPrice] = useState<string | null>(null);
  const [tradeCelebration, setTradeCelebration] = useState<TradeCelebrationKind | null>(null);

  const tokenIdOk = Number.isFinite(tokenId) && tokenId >= 0;

  // ── Data fetching ──────────────────────────────────────────────────────────

  const {
    data: listing,
    isError: listingError,
  } = useQuery({
    queryKey: ["orders", "by-token-active", tokenId],
    queryFn: () => getActiveOrderForToken(tokenId),
    retry: 1,
    enabled: tokenIdOk,
  });

  const fromCollectionParam = searchParams.get("fromCollection")?.trim() ?? "";

  // Metadata + image via backend only (shared query key with collection cards).
  const { data: metaBundle, isLoading: metaLoading } = useQuery({
    queryKey: ["marketplace-detail-metadata", tokenId],
    queryFn: () => getResolvedRwaAsset(tokenId),
    enabled: tokenIdOk,
    staleTime: 60_000,
  });

  const metadataEarly = metaBundle?.metadata ?? null;

  const pokeTierForToken = useMemo(() => {
    const g = metadataEarly?.properties?.graded as GradedCardMetadata | undefined;
    const score = g?.psa?.gradeScore ?? g?.grade?.score;
    const gradingCompany =
      g?.gradingCompany ?? (g?.psa != null ? "PSA" : undefined);
    return marketHistoryTierFromComponents({
      gradingCompany,
      gradeScore: score != null ? String(score) : undefined,
    });
  }, [metadataEarly]);

  const { data: metadataDerivedCollectionKey } = useQuery({
    queryKey: ["metadata-bucket-key", tokenId, metaBundle?.tokenURI],
    queryFn: async () => {
      const meta = metaBundle?.metadata;
      if (!meta) return null;
      const c = extractBucketComponentsFromMetadata(meta as Record<string, unknown>);
      if (!c) return null;
      return await computeMarketBucketKey(c);
    },
    enabled: tokenIdOk && !!metaBundle?.metadata,
    staleTime: 60_000,
  });

  const collectionKeyForMatch = useMemo(() => {
    const fromListing = listing?.collectionKey?.trim();
    if (fromListing) return fromListing;
    if (fromCollectionParam) return fromCollectionParam;
    return metadataDerivedCollectionKey ?? null;
  }, [listing?.collectionKey, fromCollectionParam, metadataDerivedCollectionKey]);

  const collectionKeyForRedirect = useMemo(() => {
    if (fromCollectionParam) return fromCollectionParam;
    if (listing?.collectionKey) return listing.collectionKey;
    return metadataDerivedCollectionKey ?? null;
  }, [fromCollectionParam, listing?.collectionKey, metadataDerivedCollectionKey]);

  const { data: collectionDetail } = useQuery({
    queryKey: ["marketplace-collection", collectionKeyForMatch],
    queryFn: () => getMarketplaceCollectionDetailOrNull(collectionKeyForMatch!),
    enabled: !!collectionKeyForMatch && tokenIdOk,
    staleTime: 15_000,
  });

  const { data: tokenPagePoolStats, isLoading: tokenPagePoolStatsLoading } = useQuery({
    queryKey: ["collection-market-stats", "rwa-detail", collectionKeyForMatch],
    queryFn: () => getCollectionMarketStats(collectionKeyForMatch!),
    enabled: !!collectionKeyForMatch && tokenIdOk,
    staleTime: 60_000,
  });

  const { data: tokenMarketSeries, isLoading: tokenSeriesLoading } = useQuery({
    queryKey: [
      "collection-market-series",
      "rwa-detail",
      collectionKeyForMatch,
      CHART_EXTERNAL_HISTORY,
    ],
    queryFn: () =>
      getCollectionMarketSeries(collectionKeyForMatch!, CHART_EXTERNAL_HISTORY),
    enabled: !!collectionKeyForMatch && tokenIdOk,
    staleTime: 120_000,
  });

  const { data: tokenNmHistory, isLoading: tokenNmHistLoading } = useQuery({
    queryKey: [
      "collection-market-price-history",
      "rwa-detail",
      collectionKeyForMatch,
      pokeTierForToken,
      CHART_EXTERNAL_HISTORY,
      CHART_EXTERNAL_HISTORY_DAYS,
    ],
    queryFn: () =>
      getCollectionMarketPriceHistory(collectionKeyForMatch!, {
        tier: pokeTierForToken,
        period: CHART_EXTERNAL_HISTORY,
        maxDays: CHART_EXTERNAL_HISTORY_DAYS,
      }),
    enabled: !!collectionKeyForMatch && tokenIdOk,
  });

  const { data: tokenYearHistory, isLoading: tokenYearHistLoading } = useQuery({
    queryKey: [
      "collection-market-price-history",
      "rwa-detail",
      collectionKeyForMatch,
      pokeTierForToken,
      "1y",
      365,
    ],
    queryFn: () =>
      getCollectionMarketPriceHistory(collectionKeyForMatch!, {
        tier: pokeTierForToken,
        period: "1y",
        maxDays: 365,
      }),
    enabled: !!collectionKeyForMatch && tokenIdOk,
  });

  const navigateToCollectionAfterTrade = useCallback(() => {
    if (collectionKeyForRedirect) {
      router.replace(
        `/marketplace/collections/${encodeURIComponent(collectionKeyForRedirect)}`,
        { scroll: true },
      );
    } else {
      router.replace("/?tab=marketplace", { scroll: true });
    }
  }, [router, collectionKeyForRedirect]);

  const {
    data: ownerOnChain,
    isLoading: ownerLoading,
    isError: ownerError,
  } = useReadContract({
    address: TOKENABLE_RWA_ADDRESS,
    abi: TOKENABLE_RWA_READ_ABI,
    functionName: "ownerOf",
    args: [BigInt(Math.max(0, Math.floor(tokenId)))],
    chainId: sepolia.id,
    query: {
      enabled: tokenIdOk,
      retry: 2,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      refetchInterval: false,
    },
  });

  const metadata = metadataEarly;
  const tokenURIOnChain = metaBundle?.tokenURI ?? null;

  const {
    data: activity,
    isLoading: activityLoading,
    isError: activityError,
    refetch: refetchActivity,
  } = useActivityHistory(tokenId, tokenIdOk);

  const {
    data: marketMintMap,
    isLoading: marketPreviewLoading,
    isError: marketPreviewIsError,
    error: marketPreviewErr,
  } = useQuery({
    queryKey: ["cardhedger-mint-previews", "detail", tokenId],
    queryFn: () => postBatchMintMarketPreviews([tokenId]),
    enabled: tokenIdOk,
  });

  const marketPreview = marketMintMap?.[tokenId];
  const marketPreviewError =
    marketPreviewErr instanceof Error
      ? marketPreviewErr
      : marketPreviewIsError
        ? new Error("Could not load prices")
        : null;

  const tokenGradeScoreStr = useMemo(() => {
    const g = metadata?.properties?.graded as GradedCardMetadata | undefined;
    if (g?.psa?.gradeScore != null) return String(g.psa.gradeScore);
    if (g?.grade?.score != null && Number.isFinite(g.grade.score)) return String(g.grade.score);
    return null;
  }, [metadata]);

  const tokenResolvedExternal = useMemo(
    () =>
      resolveExternalMarketUsd({
        marketPreview,
        gradePrices: tokenMarketSeries?.gradePrices ?? null,
        gradeScore: parseGradeScoreNumber(tokenGradeScoreStr),
        components: {
          gradingCompany:
            (metadata?.properties?.graded as GradedCardMetadata | undefined)
              ?.gradingCompany ??
            ((metadata?.properties?.graded as GradedCardMetadata | undefined)?.psa
              ? "PSA"
              : undefined),
          gradeScore: tokenGradeScoreStr ?? undefined,
        },
      }),
    [
      marketPreview,
      tokenMarketSeries?.gradePrices,
      tokenGradeScoreStr,
      metadata,
    ],
  );

  const tokenNmPts = tokenNmHistory?.points ?? [];
  const tokenYearPts = tokenYearHistory?.points ?? [];

  const tokenExternalVol = useMemo(() => {
    const y = coefficientOfVariationPctFromUsdSeries(tokenYearPts);
    if (y != null) return y;
    return tokenNmPts.length >= 3
      ? coefficientOfVariationPctFromUsdSeries(tokenNmPts)
      : null;
  }, [tokenNmPts, tokenYearPts]);

  const tokenPriceChange1yPct = useMemo(
    () =>
      tokenYearPts.length >= 2 ? percentChangeFromUsdPoints(tokenYearPts) : null,
    [tokenYearPts],
  );

  const tokenTierLabel = marketTierDisplayLabel(pokeTierForToken);

  const tokenVolatilityFootnote = useMemo(() => {
    const yPos = tokenYearPts.filter((p) => p.v > 0).length;
    if (yPos >= 3) return "~1y Cardhedger tier daily closes";
    const sPos = tokenNmPts.filter((p) => p.v > 0).length;
    if (sPos >= 3) return "Cardhedger chart-window tier daily closes";
    return null;
  }, [tokenYearPts, tokenNmPts]);

  const showTokenPriceChange =
    tokenYearHistLoading ||
    (tokenPriceChange1yPct != null && Number.isFinite(tokenPriceChange1yPct));
  const showTokenVolatility =
    tokenNmHistLoading ||
    tokenYearHistLoading ||
    (tokenExternalVol != null && Number.isFinite(tokenExternalVol));
  const showTokenMarketCap = false;

  // ── Buy (ask listing) ─────────────────────────────────────────────────────

  const isListingSeller =
    address?.toLowerCase() === listing?.offerer.toLowerCase();
  const collectionBids = collectionDetail?.collectionBids ?? [];

  const ownerAddr =
    typeof ownerOnChain === "string" ? ownerOnChain.toLowerCase() : "";
  const isOwner = !!(address && ownerAddr && address.toLowerCase() === ownerAddr);

  /** 컬렉션 카드에서 ?list=1 로 진입 시 판매 모달 자동 오픈 (소유자만). fromCollection 유지 */
  useEffect(() => {
    if (searchParams.get("list") !== "1") return;
    if (!tokenIdOk || ownerLoading) return;
    if (isOwner && isConnected) {
      setListModalInitialPrice(null);
      setListModalOpen(true);
    }
    const fc = searchParams.get("fromCollection");
    const next =
      fc && fc.trim()
        ? `/marketplace/${tokenId}?fromCollection=${encodeURIComponent(fc.trim())}`
        : `/marketplace/${tokenId}`;
    router.replace(next, { scroll: false });
  }, [
    searchParams,
    tokenIdOk,
    ownerLoading,
    isOwner,
    isConnected,
    tokenId,
    router,
  ]);

  async function invalidateMarketplaceQueries() {
    await queryClient.invalidateQueries({ queryKey: ["orders"] });
    await queryClient.invalidateQueries({ queryKey: ["orders", "by-token-active", tokenId] });
    await queryClient.invalidateQueries({
      queryKey: ["marketplace-detail-metadata", tokenId],
    });
    await queryClient.invalidateQueries({ queryKey: ["rwa-activity", tokenId] });
    /** 모든 지갑의 My Assets 목록·메타 (거래 후 판매자/구매자 캐시 동기화) */
    await queryClient.invalidateQueries({ queryKey: ["rwa-tokens"] });
    await queryClient.invalidateQueries({ queryKey: ["rwa-metadata-batch"] });
    await queryClient.invalidateQueries({ queryKey: ["marketplace-collection"] });
    if (collectionKeyForMatch) {
      await queryClient.invalidateQueries({
        queryKey: ["marketplace-collection", collectionKeyForMatch],
      });
    }
    await queryClient.invalidateQueries({ queryKey: ["collection-market-stats"] });
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const imageUrl = metaBundle?.imageUrl ?? null;
  const isPageLoading = ownerLoading;
  const showMain = tokenIdOk && !ownerLoading && !ownerError && ownerOnChain != null;

  return (
    <div className="min-h-screen bg-[#07090c] text-white">
      {/* ── Header ── */}
      <header className="border-b border-mint-deep/15 bg-[#07090c]/95 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4 text-sm">
          <button
            onClick={() => router.back()}
            className="text-gray-500 hover:text-white transition-colors"
          >
            ←
          </button>
          <span className="text-gray-700">/</span>
          <span className="text-gray-500">Markets</span>
          <span className="text-gray-700">/</span>
          <span className="text-white font-medium">Asset #{tokenId}</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10">
        {/* Loading */}
        {tokenIdOk && isPageLoading && (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_min(420px,100%)] gap-8 items-start">
            <div className="space-y-4">
              <div className="aspect-[3/4] max-h-[min(84vh,800px)] sm:max-h-[min(86vh,880px)] w-full bg-gray-800/90 rounded-2xl animate-pulse" />
              <div className="h-8 w-3/4 bg-gray-800 rounded animate-pulse" />
              <div className="grid grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 bg-gray-800/80 rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-7 bg-gray-800 rounded animate-pulse"
                  style={{ width: `${80 - i * 8}%` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Invalid token */}
        {!tokenIdOk && (
          <div className="text-center py-24">
            <p className="text-xl font-semibold text-white mb-2">Invalid token</p>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              ← Back
            </button>
          </div>
        )}

        {/* Not minted / ownerOf reverted */}
        {tokenIdOk && !ownerLoading && ownerError && (
          <div className="text-center py-24">
            <p className="text-5xl mb-4">🔍</p>
            <p className="text-xl font-semibold text-white mb-2">Asset not found</p>
            <p className="text-gray-500 text-sm mb-6">
              This token ID does not exist on the current contract.
            </p>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              ← Back to Markets
            </button>
          </div>
        )}

        {/* Main content */}
        {showMain && (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_min(420px,100%)] gap-8 xl:gap-10 items-start">
              {/* Left — 슬랩 이미지 · 제목 · 배지 · 카드 메타 그리드 */}
              <RwaDetailAssetPanel
                metadata={metadata as RwaDetailMetadata | null}
                imageUrl={imageUrl}
                tokenId={tokenId}
                collectionLabel={TOKENABLE_RWA_DISPLAY_NAME}
                metaLoading={metaLoading}
              />

              {/* Right column */}
              <div className="space-y-4 xl:sticky xl:top-20 xl:self-start min-w-0">
                {listingError && (
                  <p className="text-xs text-orange-400 px-1">Could not load listing.</p>
                )}

                {collectionKeyForMatch && (
                  <div className="rounded-2xl border border-gray-800/90 bg-[#0a0d11]/90 p-3 space-y-2">
                    <CollectionPriceMetricsStrip
                      externalMarketUsd={tokenResolvedExternal.usd}
                      externalPriceSource={tokenResolvedExternal.source}
                      marketTierDisplay={tokenTierLabel}
                      externalMarketMatchConfidence={
                        tokenResolvedExternal.marketMatchConfidence
                      }
                      externalPriceLoading={
                        marketPreviewLoading || tokenSeriesLoading || tokenNmHistLoading
                      }
                      externalVolatilityCvPct={tokenExternalVol}
                      volatilityFootnote={tokenVolatilityFootnote}
                      marketStats={tokenPagePoolStats ?? null}
                      marketStatsLoading={tokenPagePoolStatsLoading}
                      platformPriceSamples={[]}
                      bookSpreadPct={null}
                      externalPriceChange1yPct={tokenPriceChange1yPct}
                      externalPriceChange1yLoading={tokenYearHistLoading}
                      marketCapUsd={null}
                      marketCapMethodHint={null}
                      showPriceChange={showTokenPriceChange}
                      showVolatility={showTokenVolatility}
                      showMarketCap={showTokenMarketCap}
                      compact
                      formatMarketCap={() => "—"}
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <CollectionMarketPanel
                    data={marketPreview}
                    historyTier={pokeTierForToken}
                    tierLabel={tokenTierLabel}
                    preferredImageUrl={imageUrl}
                    isLoading={marketPreviewLoading}
                    error={marketPreviewError}
                  />
                </div>
                {marketPreview?.matched && marketPreview.card ? (
                  <div className="rounded-xl border border-gray-800/90 bg-[#0a0d11]/80 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      Cardhedger Link
                    </p>
                    <p className="mt-1 break-all font-mono text-[11px] text-zinc-300">
                      {marketPreview.card.id}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Match {marketPreview.matchConfidence ?? "unknown"}
                      {marketPreview.card.sales30d != null
                        ? ` · 30D sales ${marketPreview.card.sales30d}`
                        : ""}
                      {marketPreview.card.gainPct7d != null
                        ? ` · 7D ${marketPreview.card.gainPct7d >= 0 ? "+" : ""}${marketPreview.card.gainPct7d.toFixed(1)}%`
                        : ""}
                    </p>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-gray-800/90 bg-[#0a0d11]/90 p-3 space-y-3">
                    <button
                      type="button"
                      onClick={() => {
                        setListModalInitialPrice(null);
                        setListModalOpen(true);
                      }}
                      disabled={!isOwner || !isConnected}
                      className="w-full inline-flex min-w-0 justify-center items-center rounded-xl bg-mint/15 px-3 py-3.5 text-sm font-semibold text-mint border border-mint-deep/35 hover:bg-mint/25 disabled:opacity-35 disabled:cursor-not-allowed transition-colors shadow-[0_8px_28px_-14px_rgba(45,212,191,0.35)]"
                    >
                      {listing ? "Manage listing" : "List for sale"}
                    </button>
                  </div>

                <div className="bg-[#0a0d11]/90 border border-mint-deep/20 rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-4">Details</h3>
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-xs text-gray-500">Standard</dt>
                      <dd className="text-sm text-gray-200 mt-0.5">ERC-721</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Chain</dt>
                      <dd className="text-sm text-gray-200 mt-0.5">Ethereum Sepolia</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Token ID</dt>
                      <dd
                        className="text-sm text-gray-200 mt-0.5 font-mono"
                        title={String(tokenId)}
                      >
                        {formatTokenIdDisplay(tokenId)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Contract address</dt>
                      <dd className="mt-0.5">
                        <a
                          href={`https://sepolia.etherscan.io/address/${TOKENABLE_RWA_ADDRESS}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-mono text-mint hover:text-mint-dim"
                          title={TOKENABLE_RWA_ADDRESS}
                        >
                          {shortAddr(TOKENABLE_RWA_ADDRESS)} ↗
                        </a>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Owner address</dt>
                      <dd className="mt-0.5">
                        {(() => {
                          const o =
                            typeof ownerOnChain === "string" ? ownerOnChain : undefined;
                          if (!o) {
                            return (
                              <span className="text-sm text-gray-500">—</span>
                            );
                          }
                          return (
                            <a
                              href={`https://sepolia.etherscan.io/address/${o}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-mono text-mint hover:text-mint-dim"
                              title={o}
                            >
                              {shortAddr(o)} ↗
                            </a>
                          );
                        })()}
                      </dd>
                    </div>
                  </dl>

                  {detailsExtraOpen && (
                    <div className="mt-4 pt-4 border-t border-gray-800 space-y-3 text-sm">
                      {tokenURIOnChain && (
                        <div>
                          <p className="text-xs text-gray-500">Metadata link</p>
                          <p
                            className="mt-1 font-mono text-[11px] text-gray-400 break-all"
                            title={tokenURIOnChain}
                          >
                            {tokenURIOnChain.length > 96
                              ? `${tokenURIOnChain.slice(0, 44)}…${tokenURIOnChain.slice(-36)}`
                              : tokenURIOnChain}
                          </p>
                        </div>
                      )}
                      <div>
                        <a
                          href={`https://sepolia.etherscan.io/address/${SEAPORT_ADDRESS}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-mint hover:text-mint-dim text-sm"
                        >
                          Seaport (trading) ↗
                        </a>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setDetailsExtraOpen((v) => !v)}
                    className="mt-4 w-full text-left text-xs text-gray-500 hover:text-gray-300 transition-colors py-1"
                  >
                    {detailsExtraOpen ? "Less" : "More"}
                  </button>
                </div>
              </div>
            </div>

            {metadata?.properties && (
              <GradedMetadataPanel
                properties={metadata.properties as Record<string, unknown>}
                attributes={metadata.attributes}
              />
            )}

            <div className="rounded-2xl border border-mint-deep/20 bg-[#0a0d11]/90 overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-800/80">
                <h2 className="text-base font-semibold text-white tracking-tight">
                  Activity history
                </h2>
                {!activityLoading && (
                  <button
                    type="button"
                    onClick={() => void refetchActivity()}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                  >
                    ↻ Refresh
                  </button>
                )}
              </div>

              {activityLoading && (
                <div className="divide-y divide-gray-800/90">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="h-24 bg-white/[0.02] animate-pulse" />
                  ))}
                </div>
              )}

              {!activityLoading && activityError && (
                <div className="flex items-center justify-between px-4 py-4 border-t border-gray-800/90">
                  <p className="text-sm text-red-400">Failed to load activity.</p>
                  <button
                    type="button"
                    onClick={() => void refetchActivity()}
                    className="text-xs text-red-400 hover:text-red-200 transition-colors shrink-0"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!activityLoading && !activityError && (!activity || activity.length === 0) && (
                <div className="text-center py-10 px-4">
                  <p className="text-gray-500 text-sm">No marketplace activity yet</p>
                </div>
              )}

              {!activityLoading && !activityError && activity && activity.length > 0 && (
                <ul className="divide-y divide-gray-800/90">
                  {[...activity]
                    .sort(
                      (a, b) =>
                        parseApiUtcMs(b.updatedAt ?? b.createdAt) -
                        parseApiUtcMs(a.updatedAt ?? a.createdAt)
                    )
                    .map((order: Order) => {
                      const statusMeta: Record<
                        string,
                        { label: string; badgeClass: string }
                      > = {
                        active: {
                          label: "Listing",
                          badgeClass:
                            "bg-white/[0.06] text-gray-200 border border-white/[0.08]",
                        },
                        fulfilled: {
                          label: "Sale",
                          badgeClass:
                            "bg-white/[0.06] text-gray-200 border border-white/[0.08]",
                        },
                        cancelled: {
                          label: "Cancelled",
                          badgeClass:
                            "bg-white/[0.04] text-gray-400 border border-white/[0.06]",
                        },
                        expired: {
                          label: "Expired",
                          badgeClass:
                            "bg-white/[0.04] text-gray-400 border border-white/[0.06]",
                        },
                      };
                      const meta = statusMeta[order.status] ?? statusMeta["active"];
                      const side = order.side ?? "ask";
                      let badgeLabel = meta.label;
                      if (order.status === "active" && side === "bid") badgeLabel = "Bid";
                      if (order.status === "fulfilled" && side === "bid") badgeLabel = "Bid filled";
                      if (order.status === "active" && side === "ask") badgeLabel = "Ask";
                      const ts = Math.floor(
                        parseApiUtcMs(order.updatedAt ?? order.createdAt) / 1000
                      );
                      const priceNum = order.considerationAmount
                        ? Number(order.considerationAmount) / 1_000_000
                        : null;
                      const priceStr =
                        priceNum != null && !Number.isNaN(priceNum)
                          ? priceNum.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : null;
                      const otherRecipient = firstNonOffererRecipient(order);
                      const explorerSeller = explorerAddrPath(order.offerer);

                      let metaLine: string;
                      if (order.status === "fulfilled") {
                        if (side === "bid") {
                          metaLine = otherRecipient
                            ? `Bid ${shortAddr(order.offerer)} → ${shortAddr(otherRecipient)}`
                            : `Bid by ${shortAddr(order.offerer)}`;
                        } else if (otherRecipient) {
                          metaLine = `From ${shortAddr(order.offerer)} → ${shortAddr(otherRecipient)}`;
                        } else {
                          metaLine = `From ${shortAddr(order.offerer)}`;
                        }
                      } else if (order.status === "active") {
                        metaLine =
                          side === "bid"
                            ? `Bid by ${shortAddr(order.offerer)}`
                            : `Listed by ${shortAddr(order.offerer)}`;
                      } else {
                        metaLine = `By ${shortAddr(order.offerer)}`;
                      }

                      return (
                        <li key={order.orderHash} className="px-4 py-5">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full pl-2.5 pr-3 py-1 text-xs font-medium ${meta.badgeClass}`}
                            >
                              <IconTag className="opacity-70 shrink-0" />
                              {badgeLabel}
                            </span>
                            <a
                              href={explorerSeller}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 p-1 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
                              title="View offerer on Etherscan"
                            >
                              <IconExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                          <div className="mb-3">
                            {priceStr != null ? (
                              <p className="text-[1.65rem] leading-none font-bold text-white tracking-tight">
                                <span className="text-[0.95em] font-semibold text-gray-200">
                                  $
                                </span>
                                {priceStr}
                                <span className="text-base font-semibold text-gray-500 ml-1.5">
                                  USDC
                                </span>
                              </p>
                            ) : (
                              <p className="text-xl font-semibold text-gray-500">—</p>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 leading-relaxed">
                            <span className="text-gray-600">{metaLine}</span>
                            <span className="text-gray-600"> · </span>
                            <span>{timeAgo(ts)}</span>
                          </p>
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>

            <TradeCelebrationModal
              open={tradeCelebration != null}
              kind={tradeCelebration ?? "purchase"}
              onClose={() => setTradeCelebration(null)}
            />

            {listModalOpen && (
              <ListRwaModal
                tokenId={tokenId}
                collectionKey={collectionKeyForMatch ?? undefined}
                collectionBids={collectionBids}
                existingAskOrder={
                  listing && isListingSeller ? listing : undefined
                }
                initialPriceUsdc={listModalInitialPrice}
                onMatchedSale={() => setTradeCelebration("sale")}
                onClose={() => {
                  setListModalOpen(false);
                  setListModalInitialPrice(null);
                }}
                onListed={() => {
                  setListModalOpen(false);
                  setListModalInitialPrice(null);
                  void invalidateMarketplaceQueries();
                  navigateToCollectionAfterTrade();
                }}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
