"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPriceGames, type JustTcgPriceHistoryPoint } from "@/lib/api";
import {
  buildGameIndexComparisonSeries,
  buildGameIndexSparklinePoints,
} from "@/lib/justtcgGameValueTrend";
import { buildMarketIndexCards, type MarketIndexCard } from "@/lib/justtcgMarketIndexes";
import { ASSETS } from "@/constants/assets";
import {
  MARKET_RASTER_ICON_FRAME,
  MARKET_RASTER_ICON_IMG,
  MARKET_RASTER_ICON_IMG_NBA,
} from "@/lib/marketRasterIconFrame";

function marketIndexCardIconSrc(card: MarketIndexCard): string | undefined {
  const id = card.gameId.toLowerCase();
  const title = card.title.toLowerCase();
  if (id.includes("pokemon") || title.includes("pokemon")) {
    return ASSETS.icons.marketIndexPokemon;
  }
  if (title.includes("baseball") || /\bmlb\b/.test(id) || title.includes("mlb")) {
    return ASSETS.icons.marketIndexMlb;
  }
  if (title.includes("nfl") || /\bnfl\b/.test(id)) {
    return ASSETS.icons.marketIndexNfl;
  }
  if (title.includes("nba") || /\bnba\b/.test(id)) {
    return ASSETS.icons.marketIndexNba;
  }
  return undefined;
}

/** Compact USD for spark axis / endpoint hints (e.g. $709k, $1.2M). */
function formatSparkUsd(p: number): string {
  if (!Number.isFinite(p) || p < 0) return "—";
  if (p >= 1e9) return `$${(p / 1e9).toFixed(2)}B`;
  if (p >= 1e6) return `$${(p / 1e6).toFixed(2)}M`;
  if (p >= 1e3) return `$${(p / 1e3).toFixed(0)}k`;
  return `$${Math.round(p)}`;
}

type SparklineScale = {
  /** Value at the earliest time in the series. */
  startP: number;
  /** Value at the latest time in the series. */
  endP: number;
};

function buildSparklinePath(
  points: JustTcgPriceHistoryPoint[],
  w: number,
  h: number,
): {
  d: string;
  up: boolean;
  scale: SparklineScale | null;
} {
  const pad = 4;
  if (points.length === 0) return { d: "", up: true, scale: null };

  const sorted = [...points].sort((a, b) => a.t - b.t);
  const prices = sorted.map((x) => x.p);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = Math.max(maxP - minP, 1e-9);
  const startP = sorted[0]!.p;
  const endP = sorted[sorted.length - 1]!.p;
  const scale: SparklineScale = { startP, endP };

  if (sorted.length === 1) {
    const y = h / 2;
    const x0 = pad;
    const x1 = w - pad;
    return {
      d: `M ${x0} ${y.toFixed(2)} L ${x1} ${y.toFixed(2)}`,
      up: true,
      scale,
    };
  }

  const t0 = sorted[0]!.t;
  const t1 = sorted[sorted.length - 1]!.t;
  const tr = Math.max(t1 - t0, 1);

  const xy = sorted.map((pt) => {
    const x = pad + ((pt.t - t0) / tr) * (w - 2 * pad);
    const y = h - pad - ((pt.p - minP) / range) * (h - 2 * pad);
    return { x, y };
  });
  const coords = xy.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`);
  const d = `M ${coords.join(" L ")}`;
  const up = sorted[sorted.length - 1]!.p >= sorted[0]!.p;
  return {
    d,
    up,
    scale,
  };
}

function PriceHistorySparkline({
  points,
  showSpanAxis,
}: {
  points: JustTcgPriceHistoryPoint[] | null;
  /** When true, draw start/end dots and a ~1yr→now caption under the chart. */
  showSpanAxis?: boolean;
}) {
  const w = 280;
  const h = 72;

  const { d, up, scale } = useMemo(() => {
    if (!points?.length) {
      return { d: "", up: true, scale: null };
    }
    return buildSparklinePath(points, w, h);
  }, [points]);

  const stroke = up ? "#00c853" : "rgba(248, 113, 113, 0.95)";
  const axisMuted = "rgba(255,255,255,0.14)";

  if (!d) {
    return (
      <p className="text-[11px] leading-snug text-zinc-500">No chart data</p>
    );
  }

  const pad = 4;
  const xAxisY = h - pad;

  return (
    <div
      className="w-full"
      title={
        showSpanAxis
          ? "Time left → right (~1 year to now). Path uses 365d (or compounded shorter-window) anchor plus ~90d / ~30d / ~7d implied levels from JustTCG returns (not tick history)."
          : undefined
      }
    >
      <svg
        className="h-[72px] w-full"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <line
          x1={pad}
          y1={xAxisY}
          x2={w - pad}
          y2={xAxisY}
          stroke={axisMuted}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
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
      {showSpanAxis && scale ? (
        <div className="mt-1.5 flex justify-between gap-2 px-0.5 text-[11px] tabular-nums sm:text-xs">
          <span className="min-w-0 truncate text-white/90">
            <span className="font-semibold text-zinc-500">~1 yr</span>
            <span className="mx-1 text-zinc-600">·</span>
            <span className="font-semibold">{formatSparkUsd(scale.startP)}</span>
          </span>
          <span className="min-w-0 shrink-0 truncate text-right text-white/90">
            <span className="font-semibold text-zinc-500">Now</span>
            <span className="mx-1 text-zinc-600">·</span>
            <span className="font-semibold">{formatSparkUsd(scale.endP)}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function IndexCard({ card }: { card: MarketIndexCard }) {
  const showChart = card.demoMock || !card.synthetic;

  const series = useMemo(
    () =>
      !showChart
        ? { points: [] as JustTcgPriceHistoryPoint[], changePct: NaN, comparisonAnchorLabel: "" }
        : buildGameIndexComparisonSeries({
            valueUsd: card.valueUsd,
            change7dPct: card.change7dPct,
            change365dPct: card.change365dPct,
            change180dPct: card.change180dPct,
            rawChange90dPct: card.rawChange90dPct,
            rawChange30dPct: card.rawChange30dPct,
          }),
    [card, showChart],
  );

  const sparkPoints = useMemo(
    () =>
      !showChart
        ? []
        : buildGameIndexSparklinePoints({
            valueUsd: card.valueUsd,
            change7dPct: card.change7dPct,
            change30dPct: card.change30dPct,
            change90dPct: card.change90dPct,
            change365dPct: card.change365dPct,
            change180dPct: card.change180dPct,
            rawChange90dPct: card.rawChange90dPct,
            rawChange30dPct: card.rawChange30dPct,
          }),
    [card, showChart],
  );

  const pct = series.changePct;
  const up = pct >= 0;
  const pctFinite = showChart && Number.isFinite(pct);
  const pctSigned = pctFinite
    ? `${up ? "+" : "-"}${Math.abs(pct).toLocaleString("en-US", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}%`
    : "—";

  const pctAria = !showChart
    ? "Index not available from JustTCG catalog for this slot"
    : pctFinite
      ? `${up ? "Up" : "Down"} ${Math.abs(pct).toFixed(1)} percent vs about one year ago`
      : "Change unavailable";

  const titleIconSrc = useMemo(
    () => marketIndexCardIconSrc(card),
    [card.gameId, card.title],
  );

  const iconImgClass =
    titleIconSrc === ASSETS.icons.marketIndexNba
      ? MARKET_RASTER_ICON_IMG_NBA
      : MARKET_RASTER_ICON_IMG;

  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#121212] px-5 py-5 transition-colors hover:border-white/[0.12] sm:px-6 sm:py-6">
      <h3 className="flex min-h-[2.75rem] items-center gap-2.5 text-[15px] font-bold leading-snug text-white sm:text-base">
        {titleIconSrc ? (
          <span className={MARKET_RASTER_ICON_FRAME} aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element -- small raster badges from /public */}
            <img
              src={titleIconSrc}
              alt=""
              width={32}
              height={32}
              className={iconImgClass}
            />
          </span>
        ) : null}
        <span className="min-w-0 flex-1">{card.title}</span>
      </h3>

      <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/35 px-3 pb-3 pt-2.5 sm:px-4 sm:pb-4 sm:pt-3">
        {!showChart ? (
          <p className="min-h-[72px] px-0.5 py-2 text-left text-[11px] leading-relaxed text-zinc-500 sm:text-xs">
            No matching game row in JustTCG’s catalog for this slot yet (supported lineup is
            TCG-first). Numbers fill in automatically when{" "}
            <code className="rounded bg-white/[0.06] px-1 font-mono text-[10px] text-zinc-400">
              /price/games
            </code>{" "}
            includes one.
          </p>
        ) : (
          <PriceHistorySparkline
            points={sparkPoints.length >= 2 ? sparkPoints : null}
            showSpanAxis
          />
        )}
        <div
          className="mt-3 flex items-baseline justify-center gap-2 border-t border-white/[0.06] pt-3 sm:justify-start"
          aria-label={pctAria}
        >
          <p
            className={`text-2xl font-extrabold tabular-nums sm:text-3xl ${
              !pctFinite ? "text-zinc-500" : up ? "text-[#00c853]" : "text-red-400"
            }`}
          >
            {pctSigned}
          </p>
          {showChart ? (
            <span
              className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold tabular-nums uppercase tracking-wide text-zinc-400"
              title={series.comparisonAnchorLabel}
            >
              1Y
            </span>
          ) : null}
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
