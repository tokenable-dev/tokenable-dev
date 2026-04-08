"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
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

function MiniChart({
  points,
  width = 720,
  height = 160,
}: {
  points: number[];
  width?: number;
  height?: number;
}) {
  if (points.length < 2)
    return (
      <div
        className="flex items-center justify-center text-gray-600 text-sm"
        style={{ width, height }}
      >
        Not enough data
      </div>
    );
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const pad = 8;
  const xStep = (width - pad * 2) / (points.length - 1);
  const yScale = (v: number) =>
    height - pad - ((v - min) / range) * (height - pad * 2);
  const d = points
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"}${pad + i * xStep},${yScale(v)}`,
    )
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(148,255,212,0.18)" />
          <stop offset="100%" stopColor="rgba(148,255,212,0)" />
        </linearGradient>
      </defs>
      <path
        d={`${d} L${pad + (points.length - 1) * xStep},${height} L${pad},${height} Z`}
        fill="url(#chartGrad)"
      />
      <path d={d} fill="none" stroke="#94ffd4" strokeWidth="2" />
      <circle
        cx={pad + (points.length - 1) * xStep}
        cy={yScale(points[points.length - 1])}
        r="5"
        fill="#94ffd4"
        stroke="#030712"
        strokeWidth="2"
      />
    </svg>
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
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Chart</p>
              <p className="text-[11px] text-gray-500">Your total assets</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-white">
                  {fmtUsd(totalValue)}
                </span>
                {totalPnlPct !== 0 && (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
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
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                    period === p
                      ? "bg-mint text-[#030712]"
                      : "bg-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[180px] sm:h-[200px]">
            {isLoading ? (
              <div className="w-full h-full bg-gray-800/40 rounded-lg animate-pulse" />
            ) : (
              <MiniChart points={chartPoints} />
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
        <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5 sm:p-6 mb-6">
          <h2 className="text-base font-bold mb-4">Asset Inventory</h2>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-12 bg-gray-800/40 rounded-lg animate-pulse"
                />
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
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                    <th className="pb-3 pr-4 font-medium">Card</th>
                    <th className="pb-3 pr-4 font-medium">Amount</th>
                    <th className="pb-3 pr-4 font-medium">AVG BUY</th>
                    <th className="pb-3 pr-4 font-medium">Current</th>
                    <th className="pb-3 font-medium">P&amp;L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {assetRows.map((r) => (
                    <tr
                      key={r.tokenId}
                      className="hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700/50 overflow-hidden shrink-0 flex items-center justify-center">
                            {r.imageUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={r.imageUrl}
                                alt=""
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span className="text-[10px] text-gray-600">
                                #{r.tokenId}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-white font-medium truncate max-w-[200px]">
                              {r.name}
                            </p>
                            {r.category && (
                              <span className="inline-block mt-0.5 text-[10px] font-medium bg-gray-700/60 text-gray-400 rounded px-1.5 py-0.5">
                                {r.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-gray-300">{r.amount.toFixed(1)}</td>
                      <td className="py-3 pr-4 text-gray-300">
                        {r.avgBuy != null
                          ? `$${r.avgBuy.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                          : "—"}
                      </td>
                      <td className="py-3 pr-4 text-gray-300">
                        {r.currentPrice != null
                          ? `$${r.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                          : "—"}
                      </td>
                      <td className="py-3">
                        {r.pnl != null ? (
                          <span
                            className={
                              r.pnl >= 0 ? "text-mint" : "text-red-400"
                            }
                          >
                            {r.pnl >= 0 ? "+" : ""}${Math.abs(r.pnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            {r.pnlPct != null && (
                              <span className="ml-1 text-xs opacity-75">
                                ({r.pnlPct >= 0 ? "+" : ""}
                                {r.pnlPct.toFixed(1)}%)
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
        <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5 sm:p-6">
          <h2 className="text-base font-bold mb-4">Transaction History</h2>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-12 bg-gray-800/40 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : txRows.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              No transactions yet
            </p>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                    <th className="pb-3 pr-4 font-medium">Type</th>
                    <th className="pb-3 pr-4 font-medium">Asset</th>
                    <th className="pb-3 pr-4 font-medium">Amount</th>
                    <th className="pb-3 pr-4 font-medium">Price</th>
                    <th className="pb-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {txRows.map((tx) => (
                    <tr
                      key={tx.orderHash}
                      className="hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-block text-[11px] font-bold px-2 py-1 rounded ${
                            tx.type === "BUY"
                              ? "bg-mint/15 text-mint"
                              : "bg-red-500/15 text-red-400"
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium truncate max-w-[200px]">
                            {tx.asset}
                          </span>
                          {tx.category && (
                            <span className="text-[10px] font-medium bg-gray-700/60 text-gray-400 rounded px-1.5 py-0.5 shrink-0">
                              {tx.category}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-gray-300">{tx.amount}</td>
                      <td className="py-3 pr-4 text-gray-300">
                        ${tx.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-3 text-gray-400">{tx.date}</td>
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
