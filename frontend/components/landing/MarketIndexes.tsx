"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPriceGames, type JustTcgPriceHistoryPoint } from "@/lib/api";
import { buildImpliedGameValueTrend } from "@/lib/justtcgGameValueTrend";
import { buildMarketIndexCards, type MarketIndexCard } from "@/lib/justtcgMarketIndexes";

function formatIndexValue(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "—";
  return Math.round(usd).toLocaleString("en-US");
}

function buildSparklinePath(
  points: JustTcgPriceHistoryPoint[],
  w: number,
  h: number,
): { d: string; up: boolean } {
  const pad = 3;
  if (points.length === 0) return { d: "", up: true };

  const sorted = [...points].sort((a, b) => a.t - b.t);
  const prices = sorted.map((x) => x.p);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = Math.max(maxP - minP, 1e-9);

  if (sorted.length === 1) {
    const y = h / 2;
    return {
      d: `M ${pad} ${y.toFixed(2)} L ${(w - pad).toFixed(2)} ${y.toFixed(2)}`,
      up: true,
    };
  }

  const t0 = sorted[0].t;
  const t1 = sorted[sorted.length - 1].t;
  const tr = Math.max(t1 - t0, 1);

  const coords = sorted.map((pt) => {
    const x = ((pt.t - t0) / tr) * w;
    const y = h - pad - ((pt.p - minP) / range) * (h - 2 * pad);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const d = `M ${coords.join(" L ")}`;
  const up = sorted[sorted.length - 1].p >= sorted[0].p;
  return { d, up };
}

function PriceHistorySparkline({ points }: { points: JustTcgPriceHistoryPoint[] | null }) {
  const w = 128;
  const h = 40;

  const { d, strokeUp } = useMemo(() => {
    if (!points?.length) {
      return { d: "", strokeUp: true };
    }
    const { d: path, up } = buildSparklinePath(points, w, h);
    return { d: path, strokeUp: up };
  }, [points]);

  const stroke = strokeUp
    ? "rgba(52, 211, 153, 0.95)"
    : "rgba(248, 113, 113, 0.95)";

  if (!d) {
    return (
      <p className="mt-3 text-[10px] text-gray-600 leading-snug">
        No chart data
      </p>
    );
  }

  return (
    <div className="mt-3">
      <svg
        className="w-full max-w-[128px] h-10"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <p className="text-[9px] text-gray-600 mt-1 leading-snug">
        Market cap trend (7d / 30d / 90d %)
      </p>
    </div>
  );
}

function IndexCard({ card }: { card: MarketIndexCard }) {
  const chartPoints = useMemo(
    () =>
      buildImpliedGameValueTrend({
        valueUsd: card.valueUsd,
        change7dPct: card.change7dPct,
        change30dPct: card.change30dPct,
        change90dPct: card.change90dPct,
      }),
    [card],
  );

  const up = card.change7dPct >= 0;
  const pct = Number.isFinite(card.change7dPct)
    ? card.change7dPct.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "—";

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-[#060d0b]/75 backdrop-blur-sm px-4 py-4 sm:px-5 sm:py-5 flex flex-col transition-colors hover:border-emerald-400/35">
      <h3 className="text-sm font-bold text-white leading-snug mb-3 min-h-[2.5rem]">
        {card.title}
      </h3>

      <p className="text-2xl sm:text-[1.65rem] font-extrabold tracking-tight text-white tabular-nums">
        {formatIndexValue(card.valueUsd)}
      </p>

      <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold tabular-nums">
        <span className={up ? "text-emerald-400" : "text-red-400"}>
          {up ? "↑" : "↓"} {pct}%
        </span>
        <span className="text-gray-600 font-normal">7d (market)</span>
      </div>

      <div className="mt-auto pt-1">
        <PriceHistorySparkline points={chartPoints.length >= 2 ? chartPoints : null} />
      </div>
    </div>
  );
}

export function MarketIndexes() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["price-games"],
    queryFn: getPriceGames,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const cards = useMemo(() => {
    const games = data?.data ?? [];
    return buildMarketIndexCards(games);
  }, [data]);

  return (
    <section className="relative z-10 max-w-6xl mx-auto px-6 pb-16">
      <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight text-center mb-6">
        Market Indexes
      </h2>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-emerald-500/15 bg-gray-900/40 h-[200px] animate-pulse"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200/90">
          {error instanceof Error ? error.message : "Could not load market indexes."}
        </div>
      ) : cards.length === 0 ? (
        <p className="text-sm text-gray-500">No market data available.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <IndexCard key={card.gameId} card={card} />
          ))}
        </div>
      )}
    </section>
  );
}
