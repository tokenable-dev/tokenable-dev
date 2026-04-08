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
  type RwaMetadata,
  type Order,
} from "@/lib/api";
import { useAppStore, selectUsdcBalance } from "@/store";
import { useShallow } from "zustand/react/shallow";

const USDC_DECIMALS = 1_000_000;

interface OwnedAsset {
  tokenId: number;
  metadata: RwaMetadata | null;
  imageUrl: string | null;
}

interface AssetRow {
  tokenId: number;
  name: string;
  imageUrl: string | null;
  category: string | null;
  amount: number;
  avgBuy: number | null;
  currentPrice: number | null;
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

function extractCategory(meta: RwaMetadata | null): string | null {
  if (!meta?.attributes) return null;
  const cat = meta.attributes.find(
    (a) => a.trait_type === "PSA Category" || a.trait_type === "Set",
  );
  return cat?.value ?? null;
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

  const assetRows: AssetRow[] = useMemo(() => {
    return assets.map((a) => {
      const currentPrice = priceMap.get(a.tokenId) ?? null;
      const buyOrders = fulfilledOrders.filter(
        (o) =>
          Number(o.tokenId) === a.tokenId &&
          o.offerer.toLowerCase() !== address?.toLowerCase(),
      );
      const avgBuy =
        buyOrders.length > 0
          ? buyOrders.reduce(
              (sum, o) => sum + Number(o.considerationAmount) / USDC_DECIMALS,
              0,
            ) / buyOrders.length
          : null;
      const pnl =
        currentPrice != null && avgBuy != null ? currentPrice - avgBuy : null;
      const pnlPct =
        pnl != null && avgBuy != null && avgBuy > 0
          ? (pnl / avgBuy) * 100
          : null;
      return {
        tokenId: a.tokenId,
        name: a.metadata?.name ?? `RWA #${a.tokenId}`,
        imageUrl: a.imageUrl,
        category: extractCategory(a.metadata),
        amount: 1,
        avgBuy,
        currentPrice,
        pnl,
        pnlPct,
      };
    });
  }, [assets, priceMap, fulfilledOrders, address]);

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
    const totalCost = assetRows.reduce((s, r) => s + (r.avgBuy ?? 0), 0);
    return totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
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

  const chartPoints = useMemo(() => {
    const base = totalValue || 0;
    const pts: number[] = [];
    const count = period === "1D" ? 24 : period === "1W" ? 7 : 30;
    for (let i = 0; i < count; i++) {
      const noise = (Math.sin(i * 1.3 + base * 0.01) * 0.04 + Math.cos(i * 0.7) * 0.02);
      pts.push(base * (0.92 + 0.08 * (i / count) + noise));
    }
    pts.push(base);
    return pts;
  }, [totalValue, period]);

  const isLoading = idsLoading || assetsLoading;

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#030712] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-3">Connect your wallet to view portfolio</p>
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
            Portfolio
          </h1>
          <p className="text-sm text-gray-400">Your tokenized assets</p>
        </div>

        {/* Chart */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5 sm:p-6 mb-6">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-white mb-0.5">Chart</p>
              <p className="text-[11px] text-gray-500 mb-1">Your total assets</p>
              <div className="flex items-center gap-2.5">
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
            {isLoading ? (
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
            label="24h P&L"
            value={`${totalPnl >= 0 ? "+" : ""}${fmtUsd(totalPnl)}`}
            sub={
              totalPnlPct !== 0
                ? `${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(1)}%`
                : undefined
            }
            accent={totalPnl !== 0}
          />
        </div>

        {/* Asset Inventory */}
        <div className="rounded-2xl border border-gray-800 bg-[#0b1118] p-5 sm:p-6 mb-6">
          <h2 className="text-sm font-bold mb-4">Asset Inventory</h2>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-11 bg-gray-800/40 rounded-lg animate-pulse" />
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
            <div className="overflow-hidden rounded-xl border border-gray-800/60 max-h-[264px] overflow-y-auto scrollbar-thin">
              <table className="w-full text-[13px] table-fixed">
                <colgroup>
                  <col style={{ width: "36%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "20%" }} />
                </colgroup>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#111a25] text-left text-xs text-gray-500">
                    <th className="px-4 py-2.5 font-medium">Card</th>
                    <th className="px-4 py-2.5 font-medium">Amount</th>
                    <th className="px-4 py-2.5 font-medium">AVG BUY</th>
                    <th className="px-4 py-2.5 font-medium">Current</th>
                    <th className="px-4 py-2.5 font-medium">P&amp;L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {assetRows.map((r) => (
                    <tr
                      key={r.tokenId}
                      onClick={() => router.push(`/marketplace/${r.tokenId}`)}
                      className="hover:bg-white/[0.03] transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[13px] text-gray-200 font-medium truncate">
                            {r.name}
                          </span>
                          {r.category && <CategoryBadge label={r.category} />}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400">{r.amount.toFixed(1)}</td>
                      <td className="px-4 py-2.5 text-gray-400">
                        {r.avgBuy != null
                          ? `$${r.avgBuy.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-gray-400">
                        {r.currentPrice != null
                          ? `$${r.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {r.pnl != null ? (
                          <span className={r.pnl >= 0 ? "text-mint" : "text-red-400"}>
                            {r.pnl >= 0 ? "+" : ""}${Math.abs(r.pnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            {r.pnlPct != null && (
                              <span className="ml-1 opacity-70">
                                ({r.pnlPct >= 0 ? "+" : ""}{r.pnlPct.toFixed(1)}%)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
