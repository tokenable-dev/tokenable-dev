"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPriceGames, type JustTcgPriceHistoryPoint } from "@/lib/api";
import { buildGameIndex180dComparisonSeries } from "@/lib/justtcgGameValueTrend";
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
  const pad = 4;
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

  const t0 = sorted[0]!.t;
  const t1 = sorted[sorted.length - 1]!.t;
  const tr = Math.max(t1 - t0, 1);

  const coords = sorted.map((pt) => {
    const x = pad + ((pt.t - t0) / tr) * (w - 2 * pad);
    const y = h - pad - ((pt.p - minP) / range) * (h - 2 * pad);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const d = `M ${coords.join(" L ")}`;
  const up = sorted[sorted.length - 1]!.p >= sorted[0]!.p;
  return { d, up };
}

function PriceHistorySparkline({
  points,
}: {
  points: JustTcgPriceHistoryPoint[] | null;
}) {
  const w = 280;
  const h = 72;

  const { d, strokeUp } = useMemo(() => {
    if (!points?.length) {
      return { d: "", strokeUp: true };
    }
    const { d: path, up } = buildSparklinePath(points, w, h);
    return { d: path, strokeUp: up };
  }, [points]);

  const stroke = strokeUp ? "#00c853" : "rgba(248, 113, 113, 0.95)";

  if (!d) {
    return (
      <p className="text-[11px] leading-snug text-zinc-500">No chart data</p>
    );
  }

  return (
    <div className="w-full">
      <svg
        className="h-[72px] w-full"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

function IndexCard({ card }: { card: MarketIndexCard }) {
  const series = useMemo(
    () =>
      buildGameIndex180dComparisonSeries({
        valueUsd: card.valueUsd,
        change7dPct: card.change7dPct,
        change180dPct: card.change180dPct,
        rawChange90dPct: card.rawChange90dPct,
        rawChange30dPct: card.rawChange30dPct,
      }),
    [card],
  );

  const pct = series.changePct;
  const up = pct >= 0;
  const pctLabel = Number.isFinite(pct)
    ? Math.abs(pct).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "—";

  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#121212] px-5 py-5 transition-colors hover:border-white/[0.12] sm:px-6 sm:py-6">
      <h3 className="min-h-[2.75rem] text-[15px] font-bold leading-snug text-white sm:text-base">
        {card.title}
      </h3>

      <div className="mt-3">
        <PriceHistorySparkline
          points={series.points.length >= 2 ? series.points : null}
        />
      </div>

      <div className="mt-5 border-t border-white/[0.06] pt-4">
        <p className="text-2xl font-extrabold tracking-tight text-white tabular-nums sm:text-3xl">
          {formatIndexValue(card.valueUsd)}
        </p>

        <div className="mt-1.5 text-xs font-semibold tabular-nums sm:text-sm">
          <span className={up ? "text-[#00c853]" : "text-red-400"}>
            {pctLabel}% {up ? "↗" : "↘"}
          </span>
        </div>
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
    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-16">
      <div className="mb-8 text-center">
        <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">
          Market Indexes
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
          Numbers and charts compare the current aggregate index to about 180 days
          earlier.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[280px] animate-pulse rounded-2xl border border-white/[0.06] bg-[#121212]/80"
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          {cards.map((card) => (
            <IndexCard key={card.gameId} card={card} />
          ))}
        </div>
      )}
    </section>
  );
}
