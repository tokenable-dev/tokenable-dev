"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  getRwaTokensByOwner,
  getRwaTokenURI,
  getActiveOrders,
  getOrderHistoryByTokenId,
  fetchIpfsMetadata,
  resolveIpfsImage,
  postBatchMintPoketracePreviews,
  type RwaMetadata,
  type Order,
  type CollectionPoketracePreview,
  type PoketracePriceBand,
} from "@/lib/api";
import { useAppStore, selectUsdcBalance } from "@/store";
import { useShallow } from "zustand/react/shallow";
import type { GradedCardMetadata } from "@/types/gradedCard";
import {
  loadNmBaselineMap,
  saveNmBaselineMap,
  type NmBaselineEntry,
} from "@/lib/portfolioNmBaseline";
import {
  appendPortfolioValueSnapshot,
  loadPortfolioValueHistory,
  buildPortfolioChartPoints,
} from "@/lib/portfolioValueHistory";

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
  /** Mark for value: PokeTrace NM blend when available, else active ask */
  currentPrice: number | null;
  priceSource: "poketrace-nm" | "listing" | "none";
  nmShortLabel: string | null;
  /** Secondary line under title (set / year / card name) */
  subtitle: string;
  gradeLabel: string | null;
  acquiredLabel: string | null;
}

interface AssetRow extends PricedAssetRow {
  /** First saved NM snapshot (this browser) used for P&amp;L */
  nmBaselineUsd: number | null;
  /** Current NM vs baseline (NM market movement) */
  pnl: number | null;
  pnlPct: number | null;
}

interface TxRow {
  type: "BUY" | "SELL";
  asset: string;
  category: string | null;
  amount: number;
  price: number;
  date: string;
  orderHash: string;
}

type ChartPeriod = "1D" | "1W" | "1M";

function fmtUsd(v: number): string {
  if (Math.abs(v) >= 1000)
    return `$${(v / 1000).toFixed(1)}K`;
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** PokeTrace NM band → single USD (matches collection page blending). */
function poketraceBandPrimaryUsd(b: PoketracePriceBand | null): number | null {
  if (!b) return null;
  if (typeof b.avg === "number" && Number.isFinite(b.avg) && b.avg > 0) return b.avg;
  if (
    typeof b.low === "number" &&
    typeof b.high === "number" &&
    Number.isFinite(b.low) &&
    Number.isFinite(b.high) &&
    b.low > 0 &&
    b.high > 0
  ) {
    return (b.low + b.high) / 2;
  }
  return null;
}

function pickLongWindowPoketraceUsd(b: PoketracePriceBand | null): {
  usd: number;
  label: string;
  windowDays: number;
} | null {
  if (!b) return null;
  const order: [keyof PoketracePriceBand, string, number][] = [
    ["median30d", "30d med", 30],
    ["avg30d", "30d avg", 30],
    ["median7d", "7d med", 7],
    ["avg7d", "7d avg", 7],
    ["median3d", "3d med", 3],
    ["avg1d", "1d avg", 1],
  ];
  for (const [k, label, windowDays] of order) {
    const v = b[k];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      return { usd: v, label, windowDays };
    }
  }
  const spot = poketraceBandPrimaryUsd(b);
  if (spot != null) return { usd: spot, label: "spot", windowDays: 30 };
  return null;
}

function poketraceBlendedExternal(
  card: NonNullable<CollectionPoketracePreview["card"]>,
): { usd: number; shortLabel: string; windowDays: number } | null {
  const e = pickLongWindowPoketraceUsd(card.ebayNearMint);
  const t = pickLongWindowPoketraceUsd(card.tcgplayerNearMint);
  if (e && t) {
    return {
      usd: (e.usd + t.usd) / 2,
      shortLabel: `${e.label} + ${t.label} · eBay/TCG NM`,
      windowDays: Math.max(e.windowDays, t.windowDays),
    };
  }
  if (e) return { usd: e.usd, shortLabel: `${e.label} · eBay NM`, windowDays: e.windowDays };
  if (t) return { usd: t.usd, shortLabel: `${t.label} · TCG NM`, windowDays: t.windowDays };
  return null;
}

function extractCategory(meta: RwaMetadata | null): string | null {
  if (!meta?.attributes) return null;
  const cat = meta.attributes.find(
    (a) => a.trait_type === "PSA Category" || a.trait_type === "Set",
  );
  return cat?.value ?? null;
}

function getGraded(meta: RwaMetadata | null): GradedCardMetadata | undefined {
  const g = meta?.properties?.graded;
  return g && typeof g === "object" ? (g as GradedCardMetadata) : undefined;
}

function buildAssetSubtitle(meta: RwaMetadata | null, displayName: string): string {
  const g = getGraded(meta);
  if (g?.card) {
    const parts: string[] = [];
    if (g.card.year != null) parts.push(String(g.card.year));
    if (g.psa?.category?.trim()) parts.push(g.psa.category.trim());
    else if (g.card.set?.trim()) parts.push(g.card.set.trim());
    const cn = g.card.name?.trim();
    if (cn && cn !== displayName) parts.push(cn);
    if (parts.length > 0) return parts.join(" · ");
  }
  const attrYear = meta?.attributes?.find((a) => a.trait_type === "Year");
  const attrSet = meta?.attributes?.find(
    (a) => a.trait_type === "Set" || a.trait_type === "PSA Category",
  );
  if (attrYear?.value || attrSet?.value) {
    return [attrYear?.value, attrSet?.value].filter(Boolean).join(" · ");
  }
  const desc = meta?.description?.trim();
  if (desc && desc.length <= 200 && !desc.startsWith("http")) {
    const line = desc.split("\n")[0].trim();
    return line.length > 120 ? `${line.slice(0, 117)}…` : line;
  }
  return "";
}

function formatGradeDisplay(meta: RwaMetadata | null): string | null {
  const g = getGraded(meta);
  const company = (g?.gradingCompany ?? "PSA").trim();
  const score = g?.grade?.score ?? g?.psa?.gradeScore;
  if (score != null && String(score).trim() !== "" && !Number.isNaN(Number(score))) {
    return `${company} ${score}`.trim();
  }
  const gl = g?.psa?.gradeLabel?.trim();
  if (gl) return `${company} ${gl}`.replace(/\s+/g, " ").trim();
  const attr = meta?.attributes?.find(
    (a) =>
      a.trait_type === "Grade" ||
      (a.trait_type?.toLowerCase().includes("grade") ?? false),
  );
  return attr?.value?.trim() ?? null;
}

function earliestBuyDateLabel(
  tokenId: number,
  fulfilledOrders: Order[],
  wallet: string | undefined,
): string | null {
  if (!wallet) return null;
  const buys = fulfilledOrders.filter(
    (o) =>
      Number(o.tokenId) === tokenId &&
      o.offerer.toLowerCase() !== wallet.toLowerCase(),
  );
  if (buys.length === 0) return null;
  const t = Math.min(
    ...buys.map((o) => new Date(o.updatedAt ?? o.createdAt).getTime()),
  );
  return new Date(t).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const BADGE_COLORS: Record<string, string> = {
  pokemon: "#6b3a2a",
  "pokémon": "#6b3a2a",
  nba: "#2e3a6b",
  baseball: "#5c4024",
  football: "#4a3520",
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
  } else if (period === "1W") {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 0; i < count; i++) {
      const t = new Date(now.getTime() - (count - 1 - i) * 86400_000);
      labels.push(days[t.getDay()]);
    }
  } else {
    for (let i = 0; i < count; i++) {
      const t = new Date(now.getTime() - (count - 1 - i) * 86400_000);
      labels.push(`${t.getMonth() + 1}/${t.getDate()}`);
    }
  }
  return labels;
}

function niceYTicks(min: number, max: number, count = 5): number[] {
  if (max <= min) return [min];
  const range = max - min;
  const rough = range / (count - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const nice = [1, 2, 5, 10].find((n) => n * mag >= rough)! * mag;
  const lo = Math.floor(min / nice) * nice;
  const ticks: number[] = [];
  for (let v = lo; v <= max + nice * 0.01; v += nice) ticks.push(v);
  return ticks;
}

function fmtAxisVal(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}K`;
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function PortfolioChart({
  points,
  period,
  currentValue,
}: {
  points: number[];
  period: ChartPeriod;
  currentValue: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null);

  if (points.length < 2)
    return (
      <div className="flex items-center justify-center text-gray-600 text-sm h-full">
        Not enough data
      </div>
    );

  const W = 800;
  const H = 260;
  const LEFT = 54;
  const RIGHT = 16;
  const TOP = 20;
  const BOT = 48;
  const chartW = W - LEFT - RIGHT;
  const chartH = H - TOP - BOT;

  const dataMin = Math.min(...points);
  const dataMax = Math.max(...points);
  const pad = (dataMax - dataMin) * 0.1 || 1;
  const yMin = dataMin - pad;
  const yMax = dataMax + pad;

  const ticks = niceYTicks(yMin, yMax, 5);
  const timeLabels = generateTimeLabels(period, points.length);

  const xOf = (i: number) => LEFT + (i / (points.length - 1)) * chartW;
  const yOf = (v: number) => TOP + (1 - (v - yMin) / (yMax - yMin)) * chartH;

  const linePath = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(2)},${yOf(v).toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L${xOf(points.length - 1).toFixed(2)},${(TOP + chartH).toFixed(2)} L${xOf(0).toFixed(2)},${(TOP + chartH).toFixed(2)} Z`;

  const volumeBars = useMemo(() => {
    const bars: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const diff = i > 0 ? Math.abs(points[i] - points[i - 1]) : 0;
      bars.push(diff);
    }
    const bMax = Math.max(...bars) || 1;
    return bars.map((b) => b / bMax);
  }, [points]);

  const barH = 24;
  const barY = TOP + chartH + 2;
  const barW = Math.max(2, chartW / points.length - 1);

  const labelStep = Math.max(1, Math.floor(points.length / 6));

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((mx - LEFT) / chartW) * (points.length - 1));
    if (idx < 0 || idx >= points.length) {
      setHover(null);
      return;
    }
    setHover({ idx, x: xOf(idx), y: yOf(points[idx]) });
  }

  const lastX = xOf(points.length - 1);
  const lastY = yOf(points[points.length - 1]);

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
            <stop offset="0%" stopColor="rgba(148,255,212,0.15)" />
            <stop offset="80%" stopColor="rgba(148,255,212,0.02)" />
            <stop offset="100%" stopColor="rgba(148,255,212,0)" />
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
        {ticks.map((t) => {
          const y = yOf(t);
          if (y < TOP - 2 || y > TOP + chartH + 2) return null;
          return (
            <g key={t}>
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
                ? "rgba(148,255,212,0.5)"
                : "rgba(148,255,212,0.12)"
            }
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGrad)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#94ffd4"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Hover crosshair */}
        {hover && (
          <>
            <line
              x1={hover.x}
              x2={hover.x}
              y1={TOP}
              y2={TOP + chartH}
              stroke="rgba(148,255,212,0.2)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle
              cx={hover.x}
              cy={hover.y}
              r="4"
              fill="#94ffd4"
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
                stroke="rgba(148,255,212,0.3)"
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
                ${points[hover.idx].toLocaleString(undefined, { maximumFractionDigits: 0 })}
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
              r="5"
              fill="#94ffd4"
              stroke="#030712"
              strokeWidth="2.5"
              filter="url(#glow)"
            />
            <circle
              cx={lastX}
              cy={lastY}
              r="9"
              fill="none"
              stroke="rgba(148,255,212,0.25)"
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
                stroke="rgba(148,255,212,0.3)"
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
                ${currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </text>
            </g>
          </>
        )}
      </svg>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/40 px-5 py-5">
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <p
        className={`text-2xl font-extrabold tracking-tight ${accent ? "text-mint" : "text-white"}`}
      >
        {value}
      </p>
      {sub && (
        <p
          className={`text-xs mt-1 ${accent ? "text-mint/70" : "text-gray-500"}`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

export default function PortfolioPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { usdcBalanceFormatted } = useAppStore(useShallow(selectUsdcBalance));
  const [period, setPeriod] = useState<ChartPeriod>("1D");
  const [portfolioHistoryVersion, setPortfolioHistoryVersion] = useState(0);

  const { data: tokenIds = [], isLoading: idsLoading } = useQuery({
    queryKey: ["portfolio-ids", address],
    queryFn: () => getRwaTokensByOwner(address!),
    enabled: !!address && isConnected,
  });

  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ["portfolio-assets", tokenIds],
    queryFn: async (): Promise<OwnedAsset[]> => {
      if (!tokenIds.length) return [];
      return Promise.all(
        tokenIds.map(async (tokenId): Promise<OwnedAsset> => {
          try {
            const uri = await getRwaTokenURI(tokenId);
            const meta = uri ? await fetchIpfsMetadata(uri).catch(() => null) : null;
            return {
              tokenId,
              metadata: meta,
              imageUrl: meta?.image ? resolveIpfsImage(meta.image) : null,
            };
          } catch {
            return { tokenId, metadata: null, imageUrl: null };
          }
        }),
      );
    },
    enabled: tokenIds.length > 0,
  });

  const {
    data: poketraceByToken = {},
    isLoading: poketraceLoading,
    isError: poketraceError,
  } = useQuery({
    queryKey: ["portfolio-poketrace", address, tokenIds.join(",")],
    queryFn: () =>
      postBatchMintPoketracePreviews(
        assets.map((a) => ({ tokenId: a.tokenId, metadata: a.metadata })),
      ),
    enabled:
      Boolean(address) &&
      isConnected &&
      !assetsLoading &&
      assets.length > 0,
    staleTime: 5 * 60_000,
  });

  /** Until PokeTrace batch settles, avoid using listing $ as “current” (then switch to NM → ask). */
  const valuesPending =
    Boolean(address) &&
    isConnected &&
    assets.length > 0 &&
    poketraceLoading &&
    !poketraceError;

  const { data: allOrders = [] } = useQuery({
    queryKey: ["marketplace-orders-all"],
    queryFn: getActiveOrders,
    enabled: isConnected,
    refetchInterval: 30_000,
  });

  const { data: histories = [] } = useQuery({
    queryKey: ["portfolio-history", tokenIds],
    queryFn: async (): Promise<Order[]> => {
      if (!tokenIds.length) return [];
      const results = await Promise.all(
        tokenIds.map((id) => getOrderHistoryByTokenId(id).catch(() => [] as Order[])),
      );
      return results.flat();
    },
    enabled: tokenIds.length > 0,
  });

  const myActiveListings = useMemo(
    () =>
      allOrders.filter(
        (o) =>
          o.status === "active" &&
          (o.side === "ask" || !o.side) &&
          o.offerer.toLowerCase() === address?.toLowerCase(),
      ),
    [allOrders, address],
  );

  const priceMap = useMemo(() => {
    const m = new Map<number, number>();
    for (const o of myActiveListings) {
      m.set(Number(o.tokenId), Number(o.considerationAmount) / USDC_DECIMALS);
    }
    return m;
  }, [myActiveListings]);

  const fulfilledOrders = useMemo(
    () =>
      histories
        .filter((o) => o.status === "fulfilled")
        .sort(
          (a, b) =>
            new Date(b.updatedAt ?? b.createdAt).getTime() -
            new Date(a.updatedAt ?? a.createdAt).getTime(),
        ),
    [histories],
  );

  const [nmBaselineMap, setNmBaselineMap] = useState<
    Record<number, NmBaselineEntry>
  >({});

  useEffect(() => {
    if (!address) {
      setNmBaselineMap({});
      return;
    }
    setNmBaselineMap(loadNmBaselineMap(address));
  }, [address]);

  const pricedRows: PricedAssetRow[] = useMemo(() => {
    const pricingResolved = !poketraceLoading || poketraceError;
    return assets.map((a) => {
      const listingPrice = priceMap.get(a.tokenId) ?? null;
      const pt = poketraceByToken[a.tokenId];
      const nmBlend =
        pt?.matched && pt.card ? poketraceBlendedExternal(pt.card) : null;
      const markUsd = nmBlend?.usd ?? null;

      let currentPrice: number | null = null;
      let priceSource: PricedAssetRow["priceSource"] = "none";
      let nmShortLabel: string | null = null;

      if (pricingResolved) {
        if (markUsd != null) {
          currentPrice = markUsd;
          priceSource = "poketrace-nm";
          nmShortLabel = nmBlend?.shortLabel ?? null;
        } else if (listingPrice != null) {
          currentPrice = listingPrice;
          priceSource = "listing";
        }
      }

      const displayName = a.metadata?.name ?? `RWA #${a.tokenId}`;
      return {
        tokenId: a.tokenId,
        name: displayName,
        imageUrl: a.imageUrl,
        category: extractCategory(a.metadata),
        amount: 1,
        currentPrice,
        priceSource,
        nmShortLabel,
        subtitle: buildAssetSubtitle(a.metadata, displayName),
        gradeLabel: formatGradeDisplay(a.metadata),
        acquiredLabel: earliestBuyDateLabel(
          a.tokenId,
          fulfilledOrders,
          address,
        ),
      };
    });
  }, [
    assets,
    priceMap,
    fulfilledOrders,
    address,
    poketraceByToken,
    poketraceLoading,
    poketraceError,
  ]);

  useEffect(() => {
    if (!address || valuesPending) return;
    setNmBaselineMap((prev) => {
      let next = prev;
      let changed = false;
      for (const r of pricedRows) {
        if (r.priceSource !== "poketrace-nm" || r.currentPrice == null) continue;
        if (next[r.tokenId] !== undefined) continue;
        if (next === prev) next = { ...prev };
        changed = true;
        next[r.tokenId] = { v: r.currentPrice, t: Date.now() };
      }
      if (changed) saveNmBaselineMap(address, next);
      return changed ? next : prev;
    });
  }, [address, valuesPending, pricedRows]);

  const assetRows: AssetRow[] = useMemo(() => {
    return pricedRows.map((r) => {
      const b = nmBaselineMap[r.tokenId];
      let nmBaselineUsd: number | null = null;
      let pnl: number | null = null;
      let pnlPct: number | null = null;

      if (r.priceSource === "poketrace-nm" && r.currentPrice != null && b != null) {
        nmBaselineUsd = b.v;
        pnl = r.currentPrice - b.v;
        if (b.v > 0) pnlPct = (pnl / b.v) * 100;
      }

      return {
        ...r,
        nmBaselineUsd,
        pnl,
        pnlPct,
      };
    });
  }, [pricedRows, nmBaselineMap]);

  const txRows: TxRow[] = useMemo(() => {
    if (!address) return [];
    return fulfilledOrders.map((o) => {
      const isSeller = o.offerer.toLowerCase() === address.toLowerCase();
      const asset = assets.find((a) => a.tokenId === Number(o.tokenId));
      return {
        type: isSeller ? "SELL" : "BUY",
        asset: asset?.metadata?.name ?? `RWA #${o.tokenId}`,
        category: asset ? extractCategory(asset.metadata) : null,
        amount: 1,
        price: Number(o.considerationAmount) / USDC_DECIMALS,
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

  const totalPnl = useMemo(
    () => assetRows.reduce((s, r) => s + (r.pnl ?? 0), 0),
    [assetRows],
  );

  const totalPnlPct = useMemo(() => {
    const sumBaseline = assetRows.reduce((s, r) => s + (r.nmBaselineUsd ?? 0), 0);
    return sumBaseline > 0 ? (totalPnl / sumBaseline) * 100 : 0;
  }, [assetRows, totalPnl]);

  const uniqueTraders = useMemo(() => {
    const addrs = new Set<string>();
    for (const o of histories) {
      addrs.add(o.offerer.toLowerCase());
      for (const c of o.parameters.consideration) {
        if (c.recipient) addrs.add(c.recipient.toLowerCase());
      }
    }
    return addrs.size;
  }, [histories]);

  const isLoading = idsLoading || assetsLoading;
  const chartValuesPending = isLoading || valuesPending;

  const portfolioValueHistory = useMemo(
    () => (address ? loadPortfolioValueHistory(address) : []),
    [address, portfolioHistoryVersion],
  );

  useEffect(() => {
    if (!address || chartValuesPending) return;
    if (appendPortfolioValueSnapshot(address, totalValue)) {
      setPortfolioHistoryVersion((n) => n + 1);
    }
  }, [address, chartValuesPending, totalValue]);

  const chartPoints = useMemo(() => {
    if (chartValuesPending) return [];
    const baselineTotal = assetRows.reduce((s, r) => s + (r.nmBaselineUsd ?? 0), 0);
    const startFallback = baselineTotal > 0 ? baselineTotal : totalValue;
    return buildPortfolioChartPoints(
      portfolioValueHistory,
      period,
      Date.now(),
      totalValue,
      startFallback,
    );
  }, [portfolioValueHistory, period, totalValue, assetRows, chartValuesPending]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#030712] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-3">Connect your wallet to access My Assets</p>
          <Link
            href="/vault"
            className="text-sm text-mint hover:underline"
          >
            Go to Vault
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-20">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">
            My Assets
          </h1>
          <p className="text-sm text-gray-400">Your tokenized assets</p>
        </div>

        {/* Chart */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5 sm:p-6 mb-6">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-white mb-0.5">Chart</p>
              <p className="text-[11px] text-gray-500 mb-1">
                Total value (NM / ask) · curve from saved snapshots in this browser
              </p>
              <div className="flex items-center gap-2.5">
                {chartValuesPending ? (
                  <span className="inline-block h-9 w-28 animate-pulse rounded-lg bg-gray-800/80" />
                ) : (
                  <>
                    <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      {fmtUsd(totalValue)}
                    </span>
                    {totalPnlPct !== 0 && (
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                          totalPnlPct >= 0
                            ? "bg-mint/15 text-mint"
                            : "bg-red-500/15 text-red-400"
                        }`}
                      >
                        {totalPnlPct >= 0 ? "+" : ""}
                        {totalPnlPct.toFixed(1)}%
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              {(["1D", "1W", "1M"] as ChartPeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                    period === p
                      ? "bg-mint text-[#030712]"
                      : "border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[240px] sm:h-[280px]">
            {chartValuesPending ? (
              <div className="w-full h-full bg-gray-800/40 rounded-lg animate-pulse" />
            ) : (
              <PortfolioChart
                points={chartPoints}
                period={period}
                currentValue={totalValue}
              />
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard
            label="Amount"
            value={String(assets.length)}
            sub="Cards"
          />
          <StatCard
            label="Total Traders"
            value={String(uniqueTraders)}
            sub="All time"
          />
          <StatCard
            label="P&amp;L"
            value={
              chartValuesPending
                ? "…"
                : `${totalPnl >= 0 ? "+" : ""}${fmtUsd(totalPnl)}`
            }
            sub={
              chartValuesPending
                ? undefined
                : totalPnlPct !== 0
                  ? `${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(1)}% · NM vs baseline`
                  : "NM vs saved baseline"
            }
            accent={!chartValuesPending && totalPnl !== 0}
          />
        </div>

        {/* Asset Inventory — card grid */}
        <div className="rounded-2xl border border-gray-800 bg-[#0b1118] p-5 sm:p-6 mb-6">
          <h2 className="text-sm font-bold mb-1">Asset Inventory</h2>
          <p className="text-[11px] text-gray-500 mb-5">
            Current value uses PokeTrace NM when matched, else your ask. P&amp;L is the change in
            that NM reference vs the first value stored in this browser for each token (not
            purchase cost). Graded slab tier $ ≠ raw NM.
          </p>
          {isLoading ? (
            <div className="-mx-1 flex flex-nowrap gap-4 overflow-x-auto overflow-y-hidden pb-2 pt-0.5 scrollbar-platform">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-[min(260px,calc(100vw-4rem))] shrink-0 overflow-hidden rounded-xl border border-gray-800/80 bg-gray-900/40"
                >
                  <div className="aspect-[3/4] animate-pulse bg-gray-800/50" />
                  <div className="space-y-2 p-4">
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
          ) : (
            <div className="-mx-1 flex flex-nowrap gap-4 overflow-x-auto overflow-y-hidden pb-2 pt-0.5 scrollbar-platform snap-x snap-mandatory scroll-pl-1">
              {assetRows.map((r) => (
                <button
                  key={r.tokenId}
                  type="button"
                  onClick={() => router.push(`/marketplace/${r.tokenId}`)}
                  className="group flex w-[min(260px,calc(100vw-4rem))] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-gray-800/90 bg-gradient-to-b from-gray-900/80 to-[#0a1018] text-left shadow-lg shadow-black/20 transition-all hover:border-mint/25 hover:shadow-mint/5"
                >
                  <div className="relative aspect-[3/4] w-full bg-[#070a0f]">
                    {r.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.imageUrl}
                        alt=""
                        className="h-full w-full object-contain object-center p-3 transition-transform duration-300 group-hover:scale-[1.02]"
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
                  <div className="flex flex-1 flex-col gap-3 p-4 pt-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex min-w-0 items-start gap-2">
                        <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-tight text-white">
                          {r.name}
                        </h3>
                        {r.category && (
                          <CategoryBadge label={r.category} />
                        )}
                      </div>
                      {r.subtitle ? (
                        <p className="truncate text-[11px] leading-tight text-gray-500">
                          {r.subtitle}
                        </p>
                      ) : null}
                    </div>
                    <dl className="space-y-2 border-t border-gray-800/80 pt-3 text-[12px]">
                      <div className="space-y-0.5">
                        <div className="flex justify-between gap-2">
                          <dt className="text-gray-500">Current value</dt>
                          <dd className="font-medium tabular-nums text-gray-200">
                            {valuesPending ? (
                              <span className="inline-block h-4 w-16 animate-pulse rounded bg-gray-800/80 align-middle" />
                            ) : r.currentPrice != null ? (
                              `$${r.currentPrice.toLocaleString(undefined, {
                                maximumFractionDigits: 0,
                              })}`
                            ) : (
                              "—"
                            )}
                          </dd>
                        </div>
                        {!valuesPending && r.priceSource === "poketrace-nm" && r.nmShortLabel ? (
                          <p className="text-[10px] leading-tight text-gray-600 text-right">
                            {r.nmShortLabel}
                          </p>
                        ) : null}
                        {!valuesPending && r.priceSource === "listing" ? (
                          <p className="text-[10px] leading-tight text-gray-600 text-right">
                            Listed ask
                          </p>
                        ) : null}
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500" title="Versus first NM ref. saved in this browser for this token">
                          P&amp;L
                        </dt>
                        <dd className="tabular-nums">
                          {valuesPending ? (
                            <span className="inline-block h-4 w-20 animate-pulse rounded bg-gray-800/80 align-middle" />
                          ) : r.pnl != null ? (
                            <span
                              className={
                                r.pnl >= 0 ? "font-medium text-mint" : "font-medium text-red-400"
                              }
                            >
                              {r.pnl >= 0 ? "+" : ""}$
                              {Math.abs(r.pnl).toLocaleString(undefined, {
                                maximumFractionDigits: 0,
                              })}
                              {r.pnlPct != null && (
                                <span className="ml-1 text-[10px] opacity-80">
                                  ({r.pnlPct >= 0 ? "+" : ""}
                                  {r.pnlPct.toFixed(1)}%)
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </dd>
                      </div>
                      {!valuesPending &&
                        r.priceSource !== "poketrace-nm" &&
                        r.currentPrice != null && (
                          <p className="text-[10px] leading-snug text-gray-600">
                            P&amp;L needs a PokeTrace NM match (listed ask only here).
                          </p>
                        )}
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500">Grade</dt>
                        <dd className="text-right text-gray-200">
                          {r.gradeLabel ?? "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500">Acquired</dt>
                        <dd className="text-right text-gray-400">
                          {r.acquiredLabel ?? "—"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div className="rounded-2xl border border-gray-800 bg-[#0b1118] p-5 sm:p-6">
          <h2 className="text-sm font-bold mb-4">Transaction History</h2>
          {isLoading ? (
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
            <div className="overflow-hidden rounded-xl border border-gray-800/60 max-h-[264px] overflow-y-auto scrollbar-thin">
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
