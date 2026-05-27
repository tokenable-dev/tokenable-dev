"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import {
  type RwaMetadata,
  type OrderListItem,
  type CollectionMarketPreview,
  postPortfolioCollectionMarketBatch,
  postBatchMintMarketPreviews,
  postTokenCollectionKeysByTokenIds,
  getPortfolioDailySnapshots,
  type CollectionMarketSeries,
  type CollectionMarketStats,
  cancelOrder,
  rq,
  marketplaceRqPolicy,
} from "@/lib/core";
import { extractBucketComponentsFromMetadata, computeMarketBucketKey } from "@/lib/marketplace/bucketKey";
import { displayAssetNameFromMetadata } from "@/lib/marketplace/rwaDisplayTitle";
import { useUserAssets } from "@/hooks/useUserAssets";
import { useAppStore, selectUsdcBalance } from "@/store";
import { useShallow } from "zustand/react/shallow";
import type { GradedCardMetadata } from "@/types/gradedCard";
import { isPortfolioSellFill } from "@/lib/portfolio/portfolioTrades.util";
import {
  formatLiquidityDepthLabel,
  formatSportCategoryDisplayLabel,
  formatUsdCompact,
  parseGradeScoreNumber,
  resolveExternalMarketUsd,
} from "@/lib/market";
import { APP_MAIN_SHELL_CLASS } from "@/constants/layout";
import {
  GradientOutlineFrame,
  gradientOutlineInnerButtonClass,
  VAULT_OUTLINE_PAD_CLASS,
} from "@/components/ui/GradientOutlineFrame";
import { WalletConnect } from "@/components/wallet/WalletConnect";

const USDC_DECIMALS = 1_000_000;

interface OwnedAsset {
  tokenId: number;
  metadata: RwaMetadata | null;
  imageUrl: string | null;
}

interface PricedAssetRow {
  tokenId: number;
  name: string;
  imageUrl: string | null;
  category: string | null;
  amount: number;
  /** External NM spot: Cardhedger-backed preview, else bundle NM strip for the bucket. */
  currentPrice: number | null;
  priceSource: "cardhedger" | "none";
  /** On-platform listing depth (optional subtitle). */
  liquidityLabel: string | null;
  /** Your active ask (execution intent), not the pool estimate */
  listPriceUsd: number | null;
  /** Active ask order hash — for cancel listing from My Assets */
  activeListingOrderHash: string | null;
  /** Set / category line shown with card name (second row). */
  setName: string | null;
  /** Raw Cardhedger preview payload for this token. */
  marketPreviewRaw: CollectionMarketPreview | null;
}

type AssetRow = PricedAssetRow;

interface TxRow {
  type: "BUY" | "SELL";
  asset: string;
  category: string | null;
  amount: number;
  price: number;
  date: string;
  orderHash: string;
}

type ChartPeriod = "1D";
type AssetListFilter = "all" | "listed" | "unlisted";

function getGraded(meta: RwaMetadata | null): GradedCardMetadata | undefined {
  const g = meta?.properties?.graded;
  return g && typeof g === "object" ? (g as GradedCardMetadata) : undefined;
}

/**
 * Bucket components shape for {@link resolveExternalMarketUsd} / chart tier — matches collection detail `comp`.
 */
function marketTierComponentsFromMetadata(
  meta: RwaMetadata | null,
): Record<string, unknown> | null {
  const g = getGraded(meta);
  if (!g) return null;
  const score = g.psa?.gradeScore ?? g.grade?.score;
  const gradingCompany =
    typeof g.gradingCompany === "string" && g.gradingCompany.trim()
      ? g.gradingCompany.trim()
      : g.psa != null
        ? "PSA"
        : "";
  return {
    gradingCompany,
    gradeScore:
      score != null && Number.isFinite(Number(score)) ? String(score) : undefined,
  };
}

function extractCategory(meta: RwaMetadata | null): string | null {
  const g = getGraded(meta);
  if (g?.psa?.category?.trim()) {
    return formatSportCategoryDisplayLabel(g.psa.category.trim());
  }

  if (!meta?.attributes) return null;
  const traitTypes = [
    "PSA Category",
    "Set",
    "Sport",
    "Category",
    "Product",
    "League",
    "Card Type",
  ];
  for (const tt of traitTypes) {
    const cat = meta.attributes.find((a) => a.trait_type === tt);
    if (cat?.value != null && String(cat.value).trim() !== "")
      return formatSportCategoryDisplayLabel(String(cat.value).trim());
  }
  return null;
}

function gradeScoreFromMetadata(meta: RwaMetadata | null): number | null {
  const g = getGraded(meta);
  if (g?.psa?.gradeScore != null) return parseGradeScoreNumber(String(g.psa.gradeScore));
  if (g?.grade?.score != null && Number.isFinite(g.grade.score))
    return parseGradeScoreNumber(String(g.grade.score));
  return null;
}

/**
 * Collection `market-series` may return `cardhedgerPreview` with `matched: false` when the DB
 * bucket row exists but Cardhedger has not resolved yet — that object is still truthy, so
 * `seriesPreview ?? mintPreview` would hide a good {@link postBatchMintMarketPreviews} result.
 * Prefer whichever preview actually matched; when both match, keep series (chart-aligned).
 */
function pickPortfolioMarketPreview(
  series: CollectionMarketSeries | null | undefined,
  mintPv: CollectionMarketPreview | null | undefined,
): CollectionMarketPreview | null {
  const s = series?.cardhedgerPreview;
  const sOk = Boolean(s?.matched && s?.card);
  const mOk = Boolean(mintPv?.matched && mintPv?.card);
  if (sOk && mOk) return s!;
  if (sOk) return s!;
  if (mOk) return mintPv!;
  return s ?? mintPv ?? null;
}

function holdingsSetName(meta: RwaMetadata | null): string | null {
  const g = getGraded(meta);
  if (g?.card?.set?.trim()) return g.card.set.trim();
  if (g?.psa?.category?.trim()) {
    return formatSportCategoryDisplayLabel(g.psa.category.trim());
  }
  const attrSet = meta?.attributes?.find(
    (a) => a.trait_type === "Set" || a.trait_type === "PSA Category",
  );
  if (attrSet?.value?.trim()) return attrSet.value.trim();
  return null;
}

const BADGE_COLORS: Record<string, string> = {
  pokemon: "#6b3a2a",
  "pokémon": "#6b3a2a",
  nba: "#2e3a6b",
  basketball: "#2e3a6b",
  mlb: "#5c4024",
  baseball: "#5c4024",
  nfl: "#4a3520",
  football: "#4a3520",
  nhl: "#2a3d4a",
  hockey: "#2a3d4a",
  soccer: "#264a3a",
  yugioh: "#4a2a5c",
  "yu-gi-oh": "#4a2a5c",
  magic: "#5c2a3a",
};

function CategoryBadge({ label }: { label: string }) {
  const key = label.toLowerCase().trim();
  const bg = Object.entries(BADGE_COLORS).find(([k]) =>
    key.includes(k),
  )?.[1] ?? "#3a3a3a";
  const short =
    label.length > 12 ? label.slice(0, 10) + "…" : label;
  return (
    <span
      className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 text-gray-300"
      style={{ backgroundColor: bg }}
    >
      {short}
    </span>
  );
}

function useIsMobileViewport(maxWidthPx = 639): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [maxWidthPx]);
  return mobile;
}

function formatSnapshotAxisLabel(snapshotDateKst: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(snapshotDateKst.trim());
  if (m) return `${Number(m[2])}/${Number(m[3])}`;
  return snapshotDateKst;
}

function generateTimeLabels(period: ChartPeriod, count: number): string[] {
  const now = new Date();
  const labels: string[] = [];
  if (period === "1D") {
    for (let i = 0; i < count; i++) {
      const t = new Date(now.getTime() - (count - 1 - i) * 3600_000);
      labels.push(
        `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`,
      );
    }
  } else {
    // Daily snapshot chart (MVP). Fallback to 1D time labels.
    for (let i = 0; i < count; i++) {
      const t = new Date(now.getTime() - (count - 1 - i) * 3600_000);
      labels.push(
        `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`,
      );
    }
  }
  return labels;
}

function niceYTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (max < min) [min, max] = [max, min];
  if (max <= min) return [min];
  const range = max - min;
  const parts = Math.max(2, Math.min(12, Math.floor(Number(count)) || 5));
  let rough = range / (parts - 1);
  if (!Number.isFinite(rough) || rough <= 0) return [min, max];

  const log10 = Math.log10(rough);
  if (!Number.isFinite(log10)) return [min, max];
  const mag = Math.pow(10, Math.floor(log10));
  if (!Number.isFinite(mag) || mag <= 0) return [min, max];

  const mult = [1, 2, 5, 10].find((n) => n * mag >= rough);
  if (mult == null) return [min, max];
  let nice = mult * mag;
  if (!Number.isFinite(nice) || nice <= 0) return [min, max];

  /** When the chart span is tiny, avoid microscopic `nice` (millions of iterations / browser hang). */
  const minStep = range / 80;
  if (nice < minStep) nice = minStep;

  const lo = Math.floor(min / nice) * nice;
  if (!Number.isFinite(lo)) return [min, max];
  const hi = max + nice * 0.01;
  const ticks: number[] = [];
  const maxTicks = 64;
  for (let i = 0; i < maxTicks; i++) {
    const v = lo + i * nice;
    if (v > hi) break;
    ticks.push(v);
  }
  return ticks.length > 0 ? ticks : [min, max];
}

/** Collapse duplicate Y values (float noise / step overlap) so list keys and SVG lines stay unique. */
function uniqChartTicks(ticks: number[]): number[] {
  const out: number[] = [];
  for (const t of ticks) {
    if (!Number.isFinite(t)) continue;
    const prev = out[out.length - 1];
    if (
      prev != null &&
      Math.abs(t - prev) <= 1e-6 * Math.max(1, Math.abs(t), Math.abs(prev))
    ) {
      continue;
    }
    out.push(t);
  }
  return out;
}

function fmtAxisVal(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function PortfolioChart({
  points,
  period,
  xLabels,
  compact = false,
}: {
  points: number[];
  period: ChartPeriod;
  /** Daily snapshot dates (same length as `points` when provided). */
  xLabels?: string[];
  /** Tighter layout for mobile — larger dots, slightly smaller viewBox height. */
  compact?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null);
  const dotR = compact ? 6 : 5;
  const lastDotR = compact ? 7 : 5;
  const lastDotRingR = compact ? 11 : 9;
  const lineStroke = compact ? 2.75 : 2;

  const volumeBars = useMemo(() => {
    if (points.length < 2) return [] as number[];
    const bars: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const diff = i > 0 ? Math.abs(points[i] - points[i - 1]) : 0;
      bars.push(diff);
    }
    const bMax = Math.max(...bars) || 1;
    return bars.map((b) => b / bMax);
  }, [points]);

  if (points.length < 1)
    return (
      <div className="flex items-center justify-center text-gray-600 text-sm h-full">
        Not enough data
      </div>
    );

  const W = 800;
  const H = compact ? 200 : 260;
  const LEFT = compact ? 48 : 54;
  const RIGHT = 16;
  const TOP = compact ? 12 : 20;
  const BOT = compact ? 36 : 48;
  const chartW = W - LEFT - RIGHT;
  const chartH = H - TOP - BOT;

  const dataMin = Math.min(...points);
  const dataMax = Math.max(...points);
  const pad = (dataMax - dataMin) * 0.1 || Math.max(dataMax * 0.05, 1);
  const yMin = dataMin - pad;
  const yMax = dataMax + pad;

  const ticks = uniqChartTicks(niceYTicks(yMin, yMax, 5));
  const timeLabels =
    xLabels && xLabels.length === points.length
      ? xLabels
      : generateTimeLabels(period, points.length);

  const xOf = (i: number) => {
    if (points.length <= 1) return LEFT + chartW / 2;
    return LEFT + (i / (points.length - 1)) * chartW;
  };
  const yOf = (v: number) => TOP + (1 - (v - yMin) / (yMax - yMin)) * chartH;

  const linePath =
    points.length >= 2
      ? points
          .map((v, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(2)},${yOf(v).toFixed(2)}`)
          .join(" ")
      : "";
  const areaPath =
    points.length >= 2
      ? `${linePath} L${xOf(points.length - 1).toFixed(2)},${(TOP + chartH).toFixed(2)} L${xOf(0).toFixed(2)},${(TOP + chartH).toFixed(2)} Z`
      : "";

  const barH = 24;
  const barY = TOP + chartH + 2;
  const barW = Math.max(2, chartW / Math.max(points.length, 1) - 1);

  const labelStep = Math.max(1, Math.floor(points.length / 6));

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const idx =
      points.length <= 1
        ? 0
        : Math.round(((mx - LEFT) / chartW) * (points.length - 1));
    if (idx < 0 || idx >= points.length) {
      setHover(null);
      return;
    }
    setHover({ idx, x: xOf(idx), y: yOf(points[idx]) });
  }

  const lastIdx = points.length - 1;
  const lastX = xOf(lastIdx);
  const lastY = yOf(points[lastIdx]);
  const displayValue = points[lastIdx];

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(16,211,51,0.15)" />
            <stop offset="80%" stopColor="rgba(16,211,51,0.02)" />
            <stop offset="100%" stopColor="rgba(16,211,51,0)" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {ticks.map((t, i) => {
          const y = yOf(t);
          if (y < TOP - 2 || y > TOP + chartH + 2) return null;
          return (
            <g key={`y-grid-${i}`}>
              <line
                x1={LEFT}
                x2={W - RIGHT}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="1"
              />
              <text
                x={LEFT - 8}
                y={y + 3.5}
                textAnchor="end"
                className="fill-gray-600"
                fontSize="9"
                fontFamily="monospace"
              >
                {fmtAxisVal(t)}
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {timeLabels.map((label, i) => {
          if (i % labelStep !== 0 && i !== points.length - 1) return null;
          return (
            <text
              key={i}
              x={xOf(i)}
              y={H - 4}
              textAnchor="middle"
              className="fill-gray-600"
              fontSize="9"
              fontFamily="monospace"
            >
              {label}
            </text>
          );
        })}

        {/* Volume bars */}
        {volumeBars.map((v, i) => (
          <rect
            key={i}
            x={xOf(i) - barW / 2}
            y={barY + barH * (1 - v)}
            width={barW}
            height={barH * v}
            rx="1"
            fill={
              hover?.idx === i
                ? "rgba(16,211,51,0.5)"
                : "rgba(16,211,51,0.12)"
            }
          />
        ))}

        {/* Area fill + line (2+ daily snapshots) */}
        {points.length >= 2 && (
          <>
            <path d={areaPath} fill="url(#areaGrad)" />
            <path
              d={linePath}
              fill="none"
              stroke="#87FF48"
              strokeWidth={lineStroke}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}

        {/* Hover crosshair */}
        {hover && (
          <>
            <line
              x1={hover.x}
              x2={hover.x}
              y1={TOP}
              y2={TOP + chartH}
              stroke="rgba(16,211,51,0.2)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle
              cx={hover.x}
              cy={hover.y}
              r={dotR}
              fill="#87FF48"
              stroke="#030712"
              strokeWidth="2"
            />
            {/* Tooltip */}
            <g>
              <rect
                x={hover.x - 36}
                y={hover.y - 28}
                width="72"
                height="20"
                rx="6"
                fill="#1a2332"
                stroke="rgba(16,211,51,0.3)"
                strokeWidth="1"
              />
              <text
                x={hover.x}
                y={hover.y - 15}
                textAnchor="middle"
                fill="white"
                fontSize="10"
                fontWeight="600"
              >
                {formatUsdCompact(points[hover.idx])}
              </text>
            </g>
          </>
        )}

        {/* Current value dot + tooltip (when not hovering) */}
        {!hover && (
          <>
            <circle
              cx={lastX}
              cy={lastY}
              r={lastDotR}
              fill="#87FF48"
              stroke="#030712"
              strokeWidth="2.5"
              filter="url(#glow)"
            />
            <circle
              cx={lastX}
              cy={lastY}
              r={lastDotRingR}
              fill="none"
              stroke="rgba(16,211,51,0.25)"
              strokeWidth="1.5"
            />
            <g>
              <rect
                x={lastX - 40}
                y={lastY - 30}
                width="80"
                height="22"
                rx="6"
                fill="#1a2332"
                stroke="rgba(16,211,51,0.3)"
                strokeWidth="1"
              />
              <text
                x={lastX}
                y={lastY - 16}
                textAnchor="middle"
                fill="white"
                fontSize="11"
                fontWeight="700"
              >
                {formatUsdCompact(displayValue)}
              </text>
            </g>
          </>
        )}
      </svg>
    </div>
  );
}

function PortfolioHeaderStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  const valueClass =
    tone === "positive"
      ? "text-emerald-400/90"
      : tone === "negative"
        ? "text-red-400/90"
        : "text-zinc-100";

  return (
    <div className="flex flex-col gap-2 sm:items-end sm:text-right">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className={`text-xl font-semibold tabular-nums tracking-tight sm:text-2xl ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

export default function PortfolioPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { address, isConnected } = useAccount();
  const { usdcBalanceFormatted } = useAppStore(useShallow(selectUsdcBalance));
  const period: ChartPeriod = "1D";
  const isMobileViewport = useIsMobileViewport();
  const [assetFilter, setAssetFilter] = useState<AssetListFilter>("all");
  const [cancellingListingTokenId, setCancellingListingTokenId] = useState<number | null>(null);

  const {
    tokenIds,
    assets: hookAssets,
    activeOrders: allOrders,
    historiesFlat,
    isLoadingIds: idsLoading,
    isLoadingMetadata: assetsLoading,
    isLoadingHistoryBatch: historyBatchLoading,
    refetchActiveOrders,
  } = useUserAssets(isConnected ? address : undefined, {
    enabled: Boolean(address && isConnected),
    includeOrderHistory: true,
    includeMarketPreview: false,
  });

  const assets: OwnedAsset[] = useMemo(
    () =>
      hookAssets.map((a) => ({
        tokenId: a.tokenId,
        metadata: a.metadata,
        imageUrl: a.imageUrl,
      })),
    [hookAssets],
  );

  const listingCollectionKeyByToken = useMemo(() => {
    const m = new Map<number, string>();
    const viewer = address?.trim().toLowerCase() ?? "";
    for (const o of allOrders) {
      if (o.status !== "active" || o.side !== "ask") continue;
      const offerer = o.offerer?.trim().toLowerCase() ?? "";
      if (!offerer || offerer !== viewer) continue;
      const ck = o.collectionKey?.trim();
      if (ck) m.set(Number(o.tokenId), ck.toLowerCase());
    }
    return m;
  }, [allOrders, address]);

  /**
   * Single batched query for collection keys (replaces N× useQueries).
   * Signature must change when listing keys or metadata-derived bucket components change.
   */
  const portfolioBucketKeySourceSig = useMemo(() => {
    const parts = assets.map((a) => {
      const lk = listingCollectionKeyByToken.get(a.tokenId);
      if (lk) return `${a.tokenId}:L:${lk.toLowerCase()}`;
      const comp = extractBucketComponentsFromMetadata(
        (a.metadata ?? {}) as Record<string, unknown>,
      );
      if (!comp) return `${a.tokenId}:0`;
      return `${a.tokenId}:C:${comp.gradingCompany}|${comp.cardName}|${comp.cardSet}|${comp.gradeScore}|${comp.variantType ?? ""}`;
    });
    parts.sort();
    return parts.join("\u00a7");
  }, [assets, listingCollectionKeyByToken]);

  const { data: tokenToCollectionKey = {} } = useQuery({
    queryKey: [
      "portfolio-bucket-keys",
      address ?? "",
      portfolioBucketKeySourceSig,
    ] as const,
    queryFn: async () => {
      const o: Record<number, string> = {};
      const backendResolved = await postTokenCollectionKeysByTokenIds(
        assets.map((a) => a.tokenId),
      ).catch(() => ({} as Record<number, string>));
      for (const a of assets) {
        const listingKey = listingCollectionKeyByToken.get(a.tokenId);
        if (listingKey) {
          o[a.tokenId] = listingKey.trim().toLowerCase();
          continue;
        }
        const dbKey = backendResolved[a.tokenId];
        if (typeof dbKey === "string" && dbKey.trim()) {
          o[a.tokenId] = dbKey.trim().toLowerCase();
          continue;
        }
        const comp = extractBucketComponentsFromMetadata(
          (a.metadata ?? {}) as Record<string, unknown>,
        );
        if (!comp) continue;
        const raw = await computeMarketBucketKey(comp);
        if (typeof raw === "string" && raw.trim().length > 0) {
          o[a.tokenId] = raw.trim().toLowerCase();
        }
      }
      return o;
    },
    enabled: Boolean(address && isConnected && assets.length > 0),
    staleTime: 60_000,
  });

  /** Set NEXT_PUBLIC_MARKETPLACE_PIPELINE_DIAG=1 to compare active-listing DB key vs client meta-hash (backend logs use MARKETPLACE_PIPELINE_DIAG). */
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_MARKETPLACE_PIPELINE_DIAG !== "1") return;
    assets.forEach((a) => {
      const fromOrder = listingCollectionKeyByToken.get(a.tokenId);
      const fromMeta =
        typeof tokenToCollectionKey[a.tokenId] === "string" &&
        tokenToCollectionKey[a.tokenId]!.trim()
          ? tokenToCollectionKey[a.tokenId]!.trim().toLowerCase()
          : undefined;
      if (fromOrder && fromMeta && fromOrder !== fromMeta) {
        console.warn("[collection_key_pipeline] listing vs meta hash mismatch", {
          tokenId: a.tokenId,
          fromActiveListingOrder: fromOrder,
          fromClientMetadata: fromMeta,
          note: "Order row collection_key differs from computeMarketBucketKey(metadata).",
        });
      }
      if (fromOrder && fromMeta && fromOrder === fromMeta) {
        console.info("[collection_key_pipeline] listing and meta keys match", {
          tokenId: a.tokenId,
          collectionKey: fromOrder,
        });
      }
    });
  }, [assets, listingCollectionKeyByToken, tokenToCollectionKey]);

  const uniqueCollectionKeys = useMemo(() => {
    const s = new Set<string>();
    for (const a of assets) {
      const k = tokenToCollectionKey[a.tokenId];
      if (k) s.add(k);
    }
    return [...s];
  }, [assets, tokenToCollectionKey]);

  const portfolioMarketBatchSig = useMemo(() => {
    return [...uniqueCollectionKeys].map((k) => k.toLowerCase()).sort().join(",");
  }, [uniqueCollectionKeys]);

  const hasCollectionBuckets = uniqueCollectionKeys.length > 0;

  const {
    data: portfolioMarketBatch,
    isLoading: portfolioMarketBatchLoading,
  } = useQuery({
    queryKey: [
      "portfolio-market-batch",
      address ?? "",
      portfolioMarketBatchSig,
    ] as const,
    queryFn: () =>
      postPortfolioCollectionMarketBatch({
        collectionKeys: uniqueCollectionKeys,
        priceHistoryDuration: "max",
      }),
    enabled:
      uniqueCollectionKeys.length > 0 && Boolean(address && isConnected),
    staleTime: 120_000,
  });

  const statsByCollectionKey = useMemo(() => {
    const m = new Map<string, CollectionMarketStats>();
    for (const it of portfolioMarketBatch?.items ?? []) {
      const k = it.collectionKey.toLowerCase();
      if (it.stats) m.set(k, it.stats);
    }
    return m;
  }, [portfolioMarketBatch]);

  const seriesByCollectionKey = useMemo(() => {
    const m = new Map<string, CollectionMarketSeries>();
    for (const it of portfolioMarketBatch?.items ?? []) {
      const k = it.collectionKey.toLowerCase();
      if (it.series) m.set(k, it.series);
    }
    return m;
  }, [portfolioMarketBatch]);

  /** Lazy mint previews — only when batch series preview did not match. */
  const tokenIdsNeedingMintPreview = useMemo(() => {
    if (portfolioMarketBatchLoading) return [];
    return assets
      .filter((a) => {
        const ck = tokenToCollectionKey[a.tokenId]?.toLowerCase();
        if (!ck) return true;
        const preview = seriesByCollectionKey.get(ck)?.cardhedgerPreview;
        return !(preview?.matched && preview?.card);
      })
      .map((a) => a.tokenId);
  }, [
    assets,
    tokenToCollectionKey,
    seriesByCollectionKey,
    portfolioMarketBatchLoading,
  ]);

  const {
    data: mintPreviewByToken = {},
    isLoading: mintFallbackLoading,
  } = useQuery({
    queryKey: rq.marketMintPreviews(address, tokenIdsNeedingMintPreview),
    queryFn: () => postBatchMintMarketPreviews(tokenIdsNeedingMintPreview),
    enabled:
      Boolean(address && isConnected) &&
      tokenIdsNeedingMintPreview.length > 0 &&
      !portfolioMarketBatchLoading,
    staleTime: marketplaceRqPolicy.cardhedgerStaleMs,
  });

  const statsLoadingAny =
    portfolioMarketBatchLoading && hasCollectionBuckets;
  const seriesLoadingAny =
    portfolioMarketBatchLoading && hasCollectionBuckets;

  /** External + per-bucket series + pool stats still loading when needed */
  const valuesPending =
    Boolean(address) &&
    isConnected &&
    assets.length > 0 &&
    (mintFallbackLoading ||
      (hasCollectionBuckets && statsLoadingAny) ||
      (hasCollectionBuckets && seriesLoadingAny));

  const myActiveListings = useMemo(
    () =>
      allOrders.filter(
        (o) =>
          o.status === "active" &&
          o.side === "ask" &&
          (o.offerer?.trim().toLowerCase() ?? "") === address?.toLowerCase(),
      ),
    [allOrders, address],
  );

  const listingByTokenId = useMemo(() => {
    const m = new Map<number, { priceUsd: number; orderHash: string }>();
    for (const o of myActiveListings) {
      const tid = Number(o.tokenId);
      if (!Number.isFinite(tid)) continue;
      m.set(tid, {
        priceUsd: Number(o.price) / USDC_DECIMALS,
        orderHash: o.orderHash,
      });
    }
    return m;
  }, [myActiveListings]);

  const fulfilledOrders = useMemo(
    () =>
      historiesFlat
        .filter((o) => o.status === "fulfilled")
        .sort(
          (a, b) =>
            new Date(b.updatedAt ?? b.createdAt).getTime() -
            new Date(a.updatedAt ?? a.createdAt).getTime(),
        ),
    [historiesFlat],
  );

  const pricedRows: PricedAssetRow[] = useMemo(() => {
    return assets.map((a) => {
      const listing = listingByTokenId.get(a.tokenId);
      const listingPrice = listing?.priceUsd ?? null;
      const activeListingOrderHash = listing?.orderHash ?? null;
      const ck = tokenToCollectionKey[a.tokenId]?.toLowerCase() ?? null;
      const stats = ck ? statsByCollectionKey.get(ck) ?? null : null;
      const series = ck ? seriesByCollectionKey.get(ck) ?? null : null;

      const preview = pickPortfolioMarketPreview(
        series,
        mintPreviewByToken[a.tokenId] ?? null,
      );

      const resolved = resolveExternalMarketUsd({
        marketPreview: preview,
        gradePrices: series?.gradePrices ?? null,
        gradeScore: gradeScoreFromMetadata(a.metadata),
        components: marketTierComponentsFromMetadata(a.metadata),
      });

      let currentPrice: number | null = null;
      let priceSource: PricedAssetRow["priceSource"] = "none";
      if (
        resolved.usd != null &&
        Number.isFinite(resolved.usd) &&
        resolved.usd > 0
      ) {
        currentPrice = resolved.usd;
        priceSource = "cardhedger";
      }

      const liquidityLabel = ck
        ? formatLiquidityDepthLabel(stats ?? undefined)
        : null;

      const displayName = displayAssetNameFromMetadata(a.metadata, `RWA #${a.tokenId}`);
      return {
        tokenId: a.tokenId,
        name: displayName,
        imageUrl: a.imageUrl,
        category: extractCategory(a.metadata),
        amount: 1,
        currentPrice,
        priceSource,
        liquidityLabel,
        listPriceUsd: listingPrice,
        activeListingOrderHash,
        setName: holdingsSetName(a.metadata),
        marketPreviewRaw: preview,
      };
    });
  }, [
    assets,
    listingByTokenId,
    tokenToCollectionKey,
    statsByCollectionKey,
    seriesByCollectionKey,
    mintPreviewByToken,
  ]);

  const assetRows: AssetRow[] = useMemo(() => {
    const rows = [...pricedRows];
    // Newest minted first (higher tokenId first).
    rows.sort((a, b) => Number(b.tokenId) - Number(a.tokenId));
    return rows;
  }, [pricedRows]);

  const ASSET_PAGE = 10;
  const [visibleAssetCount, setVisibleAssetCount] = useState(ASSET_PAGE);
  const listedAssetCount = useMemo(
    () => assetRows.filter((r) => r.listPriceUsd != null).length,
    [assetRows],
  );
  const unlistedAssetCount = assetRows.length - listedAssetCount;
  const filteredAssetRows = useMemo(() => {
    if (assetFilter === "listed") return assetRows.filter((r) => r.listPriceUsd != null);
    if (assetFilter === "unlisted") return assetRows.filter((r) => r.listPriceUsd == null);
    return assetRows;
  }, [assetRows, assetFilter]);

  useEffect(() => {
    setVisibleAssetCount((n) =>
      filteredAssetRows.length === 0
        ? ASSET_PAGE
        : Math.min(Math.max(n, ASSET_PAGE), filteredAssetRows.length),
    );
  }, [filteredAssetRows.length]);

  const visibleAssetRows = useMemo(
    () => filteredAssetRows.slice(0, visibleAssetCount),
    [filteredAssetRows, visibleAssetCount],
  );

  const assetScrollSentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = assetScrollSentinelRef.current;
    if (!el || visibleAssetCount >= filteredAssetRows.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleAssetCount((c) => Math.min(c + ASSET_PAGE, filteredAssetRows.length));
        }
      },
      { root: null, rootMargin: "160px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visibleAssetCount, filteredAssetRows.length]);

  const txRows: TxRow[] = useMemo(() => {
    if (!address) return [];
    return fulfilledOrders.map((o) => {
      const isSeller = isPortfolioSellFill(o, address);
      const asset = assets.find((a) => a.tokenId === Number(o.tokenId));
      return {
        type: isSeller ? "SELL" : "BUY",
        asset: asset?.metadata?.name ?? `RWA #${o.tokenId}`,
        category: asset ? extractCategory(asset.metadata) : null,
        amount: 1,
        price: Number(o.price) / USDC_DECIMALS,
        date: new Date(o.updatedAt ?? o.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        orderHash: o.orderHash,
      };
    });
  }, [fulfilledOrders, address, assets]);

  const totalValue = useMemo(
    () => assetRows.reduce((s, r) => s + (r.currentPrice ?? 0), 0),
    [assetRows],
  );

  const {
    data: dailySnapshotsData,
    isLoading: dailySnapshotsLoading,
  } = useQuery({
    queryKey: ["portfolio-daily-snapshots", address ?? ""] as const,
    queryFn: () => getPortfolioDailySnapshots(address!, 32),
    enabled: Boolean(address && isConnected),
    staleTime: 120_000,
  });
  const dailyPnlUsd = dailySnapshotsData?.latest24h?.pnlUsd ?? null;
  const dailyPnlPct = dailySnapshotsData?.latest24h?.pnlPct ?? null;
  const hasDailyPnl = dailyPnlUsd != null;

  const totalTrades = fulfilledOrders.length;

  /**
   * My Assets grid: show cards as soon as token IDs + metadata batch return.
   * Market preview + pool/series power row-level price skeletons via `valuesPending`.
   */
  const assetsSectionLoading = idsLoading || assetsLoading;

  /** Only block totals/chart curve while holdings list is unresolved or series for pricing paths are unavailable. */
  const chartTotalsPending = idsLoading || dailySnapshotsLoading;

  const dailyChartSeries = useMemo(() => {
    const rows = dailySnapshotsData?.items ?? [];
    const sorted = [...rows].sort(
      (a, b) => new Date(a.snapshotAt).getTime() - new Date(b.snapshotAt).getTime(),
    );
    const series: { value: number; label: string }[] = [];
    for (const r of sorted) {
      const v = r.totalValueUsd;
      if (!Number.isFinite(v) || v < 0) continue;
      series.push({
        value: v,
        label: formatSnapshotAxisLabel(r.snapshotDateKst),
      });
    }
    return series;
  }, [dailySnapshotsData?.items]);

  const dailyChartPoints = useMemo(
    () => dailyChartSeries.map((s) => s.value),
    [dailyChartSeries],
  );
  const dailyChartLabels = useMemo(
    () => dailyChartSeries.map((s) => s.label),
    [dailyChartSeries],
  );

  if (!isConnected) {
    return (
      <div className="min-h-screen min-w-0 overflow-x-clip bg-black text-white">
        <div className={`${APP_MAIN_SHELL_CLASS} flex min-h-[calc(100vh-4rem)] flex-col justify-center py-8 pb-20`}>
          <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center">
            <div className="w-full rounded-2xl border border-gray-800/90 bg-gray-900/40 px-6 py-9 text-center sm:px-8 sm:py-10">
              <h2 className="text-lg font-semibold tracking-tight text-white">
                Connect your wallet
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                Connect MetaMask on Sepolia to view your holdings, estimated
                value, and activity in your portfolio.
              </p>
              <div className="mt-7">
                <GradientOutlineFrame
                  className="w-full"
                  padClass={VAULT_OUTLINE_PAD_CLASS}
                >
                  <WalletConnect
                    connectButtonClassName={`${gradientOutlineInnerButtonClass} !rounded-[11px] py-3.5 text-sm`}
                    connectButtonStyle={{ backgroundColor: "#000000" }}
                  />
                </GradientOutlineFrame>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-black text-white">
      <div className={`${APP_MAIN_SHELL_CLASS} py-8 pb-20`}>
        {/* Title + summary stats */}
        <div className="mb-6 flex flex-col gap-6 sm:mb-10 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight sm:text-3xl">
              Portfolio
            </h1>
          </div>
          <div
            className="flex flex-wrap items-end gap-x-14 gap-y-6 sm:ml-auto sm:gap-x-16 lg:gap-x-20"
            role="group"
            aria-label="Portfolio summary"
          >
            <PortfolioHeaderStat label="Amount" value={String(assets.length)} />
            <PortfolioHeaderStat label="Total trades" value={String(totalTrades)} />
            <PortfolioHeaderStat
              label="P&L"
              value={
                chartTotalsPending
                  ? "…"
                  : !hasDailyPnl
                    ? "—"
                    : `${dailyPnlUsd! >= 0 ? "+" : ""}${formatUsdCompact(dailyPnlUsd!)}`
              }
              tone={
                chartTotalsPending || !hasDailyPnl
                  ? "neutral"
                  : dailyPnlUsd! > 0
                    ? "positive"
                    : dailyPnlUsd! < 0
                      ? "negative"
                      : "neutral"
              }
            />
          </div>
        </div>

        {/* Chart */}
        <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-900/40 p-4 sm:p-6">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-0.5 text-sm font-semibold text-white">Chart</p>
              <div className="flex flex-wrap items-center gap-2">
                {chartTotalsPending ? (
                  <span className="inline-block h-8 w-24 animate-pulse rounded-lg bg-gray-800/80 sm:h-9 sm:w-28" />
                ) : (
                  <>
                    <span className="text-xl font-extrabold tracking-tight text-white sm:text-3xl">
                      {formatUsdCompact(totalValue)}
                    </span>
                    {dailyPnlPct != null && dailyPnlPct !== 0 && (
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                          dailyPnlPct >= 0
                            ? "bg-mint/15 text-mint"
                            : "bg-red-500/15 text-red-400"
                        }`}
                      >
                        {dailyPnlPct >= 0 ? "+" : ""}
                        {dailyPnlPct.toFixed(1)}%
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="rounded-full bg-mint px-3 py-1.5 text-xs font-semibold text-[#030712]">1D</div>
          </div>
          <div className="h-[168px] sm:h-[240px] lg:h-[280px]">
            {chartTotalsPending ? (
              <div className="h-full w-full animate-pulse rounded-lg bg-gray-800/40" />
            ) : (
              <PortfolioChart
                points={dailyChartPoints}
                xLabels={dailyChartLabels}
                period={period}
                compact={isMobileViewport}
              />
            )}
          </div>
        </div>

        {/* Holdings — card grid */}
        <div className="mb-6 rounded-2xl border border-gray-800 bg-[#0b1118] p-4 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">My Collectibles</h2>
              <p className="mt-1 text-xs text-gray-500">
                Your vaulted cards and active listings.
              </p>
            </div>
            <div className="inline-flex rounded-full border border-gray-700/80 bg-gray-900/70 p-1 text-[11px]">
              <button
                type="button"
                onClick={() => setAssetFilter("all")}
                className={`rounded-full px-3 py-1 font-semibold transition-colors ${
                  assetFilter === "all" ? "bg-mint text-[#061018]" : "text-gray-400 hover:text-white"
                }`}
              >
                All <span className="tabular-nums">({assetRows.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setAssetFilter("listed")}
                className={`rounded-full px-3 py-1 font-semibold transition-colors ${
                  assetFilter === "listed"
                    ? "bg-mint text-mint-ink"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Listed <span className="tabular-nums">({listedAssetCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setAssetFilter("unlisted")}
                className={`rounded-full px-3 py-1 font-semibold transition-colors ${
                  assetFilter === "unlisted"
                    ? "bg-zinc-500/90 text-[#061018]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Not listed <span className="tabular-nums">({unlistedAssetCount})</span>
              </button>
            </div>
          </div>
          {mintFallbackLoading && !assetsSectionLoading && assets.length > 0 ? (
            <p className="mb-3 text-[11px] text-zinc-500">
              Updating Cardhedger market estimates…
            </p>
          ) : null}
          {assetsSectionLoading ? (
            <div className="-mx-0.5 grid grid-cols-2 gap-2.5 pb-2 pt-0.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="w-full overflow-hidden rounded-lg border border-gray-800/80 bg-gray-900/40 sm:rounded-xl"
                >
                  <div className="aspect-[5/6] animate-pulse bg-gray-800/50 sm:aspect-[3/4]" />
                  <div className="space-y-2 p-2.5 sm:p-4">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-gray-800/60" />
                    <div className="h-3 w-full animate-pulse rounded bg-gray-800/40" />
                  </div>
                </div>
              ))}
            </div>
          ) : assetRows.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              No assets yet.{" "}
              <Link href="/vault" className="text-mint hover:underline">
                Mint your first card
              </Link>
            </p>
          ) : filteredAssetRows.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              {assetFilter === "listed"
                ? "No cards are currently listed for sale."
                : "All cards are currently listed. Cancel a listing to move back to not listed."}
            </p>
          ) : (
            <div
              className={
                filteredAssetRows.length > 4
                  ? "max-h-[min(70vh,560px)] overflow-y-auto pr-0.5 sm:max-h-[560px]"
                  : "overflow-visible"
              }
            >
              <div className="-mx-0.5 grid grid-cols-2 gap-2.5 pb-2 pt-0.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {filteredAssetRows.map((r) => {
                const titleLine = r.setName
                  ? `${r.name} · ${r.setName}`
                  : r.name;
                return (
                <div
                  key={r.tokenId}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    router.push(`/marketplace/${r.tokenId}`);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/marketplace/${r.tokenId}`);
                    }
                  }}
                  className="group flex w-full cursor-pointer flex-col overflow-hidden rounded-lg bg-gradient-to-b from-gray-900/80 to-[#0a1018] text-left shadow-md shadow-black/20 outline-none transition-[box-shadow,background-color] duration-200 hover:bg-gray-900/90 hover:shadow-[0_14px_44px_-14px_rgba(0,0,0,0.75)] focus-visible:ring-2 focus-visible:ring-zinc-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030712] sm:rounded-xl sm:shadow-lg"
                >
                  <div className="relative aspect-[5/6] w-full bg-[#070a0f] sm:aspect-[3/4]">
                    {r.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.imageUrl}
                        alt=""
                        className="h-full w-full object-contain object-center p-1.5 transition-transform duration-300 group-hover:scale-[1.02] sm:p-3"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
                        <span className="font-mono text-[11px] text-gray-600">#{r.tokenId}</span>
                        <span className="text-[10px] text-gray-600">No preview image</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-2.5 pt-2 sm:gap-3 sm:p-4 sm:pt-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-1">
                        {r.listPriceUsd != null ? (
                          <span className="inline-flex shrink-0 items-center rounded-full bg-mint/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-mint sm:px-2 sm:text-[10px]">
                            Listed
                          </span>
                        ) : null}
                        {r.category ? <CategoryBadge label={r.category} /> : null}
                      </div>
                      <p
                        className="truncate text-[11px] font-semibold leading-tight text-white sm:text-[13px]"
                        title={titleLine}
                      >
                        {titleLine}
                      </p>
                    </div>
                    <div className="space-y-0.5 border-t border-gray-800/80 pt-2 text-[10px] leading-snug sm:space-y-1 sm:pt-3 sm:text-[12px]">
                      <p className="min-w-0 truncate text-gray-400">
                        <span className="sm:hidden">Ask: </span>
                        <span className="hidden sm:inline">Your Ask Price : </span>
                        <span className="font-semibold tabular-nums text-white">
                          {r.listPriceUsd != null ? formatUsdCompact(r.listPriceUsd) : "—"}
                        </span>
                      </p>
                      <p className="min-w-0 truncate text-gray-400">
                        <span className="sm:hidden">Mkt: </span>
                        <span className="hidden sm:inline">Market Price : </span>
                        <span className="font-semibold tabular-nums text-white">
                          {valuesPending && r.currentPrice == null ? (
                            <span className="inline-block h-3 w-12 animate-pulse rounded bg-gray-800/80 align-middle sm:h-3.5 sm:w-14" />
                          ) : r.currentPrice != null ? (
                            formatUsdCompact(r.currentPrice)
                          ) : (
                            "—"
                          )}
                        </span>
                      </p>
                    </div>
                    {r.listPriceUsd != null && r.activeListingOrderHash && address ? (
                      <div className="border-t border-gray-800/80 pt-2 sm:pt-3">
                        <button
                          type="button"
                          disabled={cancellingListingTokenId === r.tokenId}
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!address || !r.activeListingOrderHash) return;
                            setCancellingListingTokenId(r.tokenId);
                            const qk = rq.ordersActive();
                            const prev = queryClient.getQueryData<OrderListItem[]>(qk);
                            queryClient.setQueryData<OrderListItem[]>(qk, (old) =>
                              (old ?? []).filter(
                                (o) => o.orderHash !== r.activeListingOrderHash,
                              ),
                            );
                            try {
                              await cancelOrder(r.activeListingOrderHash, address);
                              await refetchActiveOrders();
                            } catch (err) {
                              if (prev !== undefined) {
                                queryClient.setQueryData(qk, prev);
                              } else {
                                void queryClient.invalidateQueries({ queryKey: qk });
                              }
                              window.alert(
                                err instanceof Error
                                  ? err.message
                                  : "Failed to cancel listing",
                              );
                            } finally {
                              setCancellingListingTokenId(null);
                            }
                          }}
                          className="w-full rounded-md border border-rose-500/35 bg-rose-500/10 px-2 py-1.5 text-center text-[10px] font-semibold text-rose-200 transition-colors hover:border-rose-400/45 hover:bg-rose-500/18 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-lg sm:px-3 sm:py-2.5 sm:text-[12px]"
                        >
                          {cancellingListingTokenId === r.tokenId
                            ? "Cancelling…"
                            : "Cancel listing"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                );
              })}
              </div>
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div className="rounded-2xl border border-gray-800 bg-[#0b1118] p-5 sm:p-6">
          <h2 className="text-sm font-bold mb-4">Transaction History</h2>
          {(idsLoading || historyBatchLoading) ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-11 bg-gray-800/40 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : txRows.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              No transactions yet
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-800/60 max-h-[264px] overflow-y-auto">
              <table className="w-full text-[13px] table-fixed">
                <colgroup>
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "36%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "24%" }} />
                </colgroup>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#111a25] text-left text-xs text-gray-500">
                    <th className="px-4 py-2.5 font-medium">Type</th>
                    <th className="px-4 py-2.5 font-medium">Asset</th>
                    <th className="px-4 py-2.5 font-medium">Amount</th>
                    <th className="px-4 py-2.5 font-medium">Price</th>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {txRows.map((tx) => (
                    <tr
                      key={tx.orderHash}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center justify-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
                            tx.type === "BUY"
                              ? "bg-mint/15 text-mint"
                              : "bg-red-500/15 text-red-400"
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[13px] text-gray-200 font-medium truncate">
                            {tx.asset}
                          </span>
                          {tx.category && <CategoryBadge label={tx.category} />}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400">{tx.amount}</td>
                      <td className="px-4 py-2.5 text-gray-400">
                        ${tx.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">{tx.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
