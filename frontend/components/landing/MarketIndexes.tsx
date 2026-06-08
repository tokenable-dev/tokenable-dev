"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCardladderIndexes,
  type CardladderDashboardIndexId,
  type CardladderDashboardIndexRow,
} from "@/lib/core";
import { rq } from "@/lib/core/queryKeys";
import { ASSETS } from "@/constants/assets";
import {
  MARKET_RASTER_ICON_FRAME,
  MARKET_RASTER_ICON_IMG,
  MARKET_RASTER_ICON_IMG_NBA,
} from "@/lib/market";

const SLOT_LABELS: Record<CardladderDashboardIndexId, string> = {
  pokemon: "Pokemon",
  mlb: "MLB",
  nfl: "NFL",
  nba: "NBA",
};

function slotIconSrc(id: CardladderDashboardIndexId): string {
  switch (id) {
    case "pokemon":
      return ASSETS.icons.marketIndexPokemon;
    case "mlb":
      return ASSETS.icons.marketIndexMlb;
    case "nfl":
      return ASSETS.icons.marketIndexNfl;
    case "nba":
      return ASSETS.icons.marketIndexNba;
  }
}

function formatChangePct(changePct: number | null): string {
  if (changePct == null || !Number.isFinite(changePct)) return "—";
  const up = changePct >= 0;
  return `${up ? "+" : ""}${changePct.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function TrendSparkline({ up }: { up: boolean }) {
  const stroke = up ? "#00c853" : "rgba(248, 113, 113, 0.95)";
  const d = up
    ? "M 8 52 C 48 44, 72 40, 112 28 S 196 18, 272 14"
    : "M 8 18 C 48 26, 72 30, 112 42 S 196 52, 272 56";

  return (
    <svg
      className="h-[72px] w-full"
      viewBox="0 0 280 72"
      preserveAspectRatio="none"
      aria-hidden
    >
      <line
        x1="8"
        y1="64"
        x2="272"
        y2="64"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function IndexCard({
  row,
  loading,
}: {
  row: CardladderDashboardIndexRow;
  loading: boolean;
}) {
  const label = SLOT_LABELS[row.id];
  const iconSrc = slotIconSrc(row.id);
  const iconImgClass =
    row.id === "nba" ? MARKET_RASTER_ICON_IMG_NBA : MARKET_RASTER_ICON_IMG;
  const hasValue = row.changePct != null && Number.isFinite(row.changePct);
  const up = hasValue ? row.changePct! >= 0 : true;
  const pctSigned = formatChangePct(row.changePct);

  const pctClass = `font-extrabold tabular-nums ${
    !hasValue ? "text-zinc-500" : up ? "text-[#00c853]" : "text-red-400"
  }`;

  const pctAria = loading
    ? "Loading market index data"
    : hasValue
      ? `${up ? "Up" : "Down"} ${Math.abs(row.changePct!).toFixed(2)} percent`
      : "Change unavailable";

  return (
    <article
      className="flex w-[10.25rem] shrink-0 snap-start flex-col rounded-xl border border-white/[0.08] bg-[#121212] px-3.5 py-3.5 transition-colors max-sm:snap-center sm:w-auto sm:shrink sm:rounded-2xl sm:px-6 sm:py-6 hover:border-white/[0.12]"
      aria-label={label}
    >
      {/* Mobile — compact: icon, label, % (no tall chart) */}
      <div className="flex min-h-[5.5rem] flex-col justify-between sm:hidden">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={iconSrc}
              alt=""
              width={28}
              height={28}
              className={`${iconImgClass} h-7 w-7 max-h-none max-w-none object-contain`}
            />
          </span>
          <span className="min-w-0 text-[13px] font-bold leading-tight text-white">
            {label}
          </span>
        </div>

        {loading ? (
          <div className="flex flex-1 items-end pt-3" role="status" aria-live="polite" aria-busy="true">
            <span className="inline-block h-7 w-20 animate-pulse rounded bg-zinc-700/60" />
          </div>
        ) : (
          <p className={`pt-3 text-[1.35rem] leading-none ${pctClass}`} aria-label={pctAria}>
            {pctSigned}
          </p>
        )}
      </div>

      {/* sm+ — full card with sparkline */}
      <div className="hidden sm:flex sm:flex-col">
        <h3 className="flex min-h-[2.75rem] items-center gap-2.5 text-base font-bold leading-snug text-white">
          <span className={MARKET_RASTER_ICON_FRAME} aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={iconSrc}
              alt=""
              width={32}
              height={32}
              className={iconImgClass}
            />
          </span>
          <span className="min-w-0 flex-1">{label}</span>
        </h3>

        <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/35 px-4 pb-4 pt-3">
          {loading ? (
            <div
              className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-lg border border-white/[0.05] bg-[#030304]/80 px-2 py-3"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div
                className="h-7 w-7 animate-spin rounded-full border-2 border-solid border-t-transparent"
                style={{
                  borderColor: "rgba(45, 232, 210, 0.35)",
                  borderTopColor: "transparent",
                }}
              />
              <p className="text-[11px] text-zinc-500">Loading index…</p>
            </div>
          ) : !hasValue ? (
            <p className="min-h-[72px] px-0.5 py-2 text-left text-xs leading-relaxed text-zinc-500">
              Index data is temporarily unavailable.
            </p>
          ) : (
            <TrendSparkline up={up} />
          )}

          <div
            className="mt-3 flex items-baseline justify-start gap-2 border-t border-white/[0.06] pt-3"
            aria-label={pctAria}
          >
            {loading ? (
              <span className="inline-block h-8 w-24 animate-pulse rounded bg-zinc-700/60" />
            ) : (
              <p className={`text-2xl sm:text-3xl ${pctClass}`}>{pctSigned}</p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

const PLACEHOLDER_ROWS: CardladderDashboardIndexRow[] = [
  { id: "pokemon", slug: "pokemon", name: "Pokemon", changePct: null, direction: null },
  { id: "mlb", slug: "baseball", name: "Baseball", changePct: null, direction: null },
  { id: "nfl", slug: "football", name: "Football", changePct: null, direction: null },
  { id: "nba", slug: "basketball", name: "Basketball", changePct: null, direction: null },
];

const INDEX_RAIL =
  "mobile-scroll-x-contain flex w-full min-w-0 flex-nowrap items-stretch gap-2.5 overflow-x-auto scroll-smooth touch-pan-x snap-x snap-mandatory scroll-px-4 pb-1 pr-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:scroll-px-0 sm:pr-0 sm:pb-0 lg:grid-cols-4";

export function MarketIndexes() {
  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: rq.cardladderIndexes(),
    queryFn: () => getCardladderIndexes(),
    staleTime: 5 * 60_000,
    retry: 2,
    refetchInterval: (query) => {
      const rows = query.state.data?.data ?? [];
      const awaitingScrape =
        rows.length > 0 &&
        rows.every((r) => r.changePct == null || !Number.isFinite(r.changePct));
      return awaitingScrape ? 8_000 : 10 * 60_000;
    },
  });

  const rows = useMemo(() => {
    const fromApi = data?.data ?? [];
    if (fromApi.length === 0) return PLACEHOLDER_ROWS;
    const order: CardladderDashboardIndexId[] = ["pokemon", "mlb", "nfl", "nba"];
    return order.map(
      (id) => fromApi.find((r) => r.id === id) ?? PLACEHOLDER_ROWS.find((r) => r.id === id)!,
    );
  }, [data]);

  const loading = isLoading || (isFetching && !data);

  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl max-sm:px-0 sm:px-6 pb-10 sm:pb-16">
      <div className="mb-4 px-4 text-center sm:mb-8 sm:px-0">
        <h2 className="text-base font-bold tracking-tight text-white sm:text-xl">
          Market Indexes
        </h2>
      </div>

      {isError ? (
        <div className="mx-4 mb-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200/90 sm:mx-0">
          {error instanceof Error ? error.message : "Could not load market indexes."}
        </div>
      ) : null}

      <div className={INDEX_RAIL}>
        {rows.map((row) => (
          <IndexCard key={row.id} row={row} loading={loading} />
        ))}
      </div>
    </section>
  );
}
