"use client";

import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState, type CSSProperties } from "react";
import { PortfolioValueChart } from "@/components/portfolio/PortfolioValueChart";
import { useTop100DayChanges } from "@/hooks/markets/useTop100DayChanges";
import { useTop100 } from "@/hooks/markets/usePokemonTop100";
import { useTop100CardDetail } from "@/hooks/markets/useTop100CardDetail";
import {
  buildTop100DetailFields,
  buildTop100EbaySearchQuery,
  formatTop100Usd,
  resolveTop100ImageUrl,
  top100CardSubText,
  top100CardTitle,
} from "@/lib/markets/top100CardDisplay";
import type { Top100PriceMetrics } from "@/lib/markets/top100PriceMetrics";
import { Top100DayChangeBadge } from "./Top100DayChangeBadge";

const IMAGE_FILTER: CSSProperties = {
  filter: "saturate(1.04) contrast(1.02)",
};

const CHART_DAYS_OPTIONS = [30, 90] as const;

function formatChangePct(pct: number | null | undefined): string {
  if (pct == null) return "—";
  return `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%`;
}

function PriceStat({
  label,
  value,
  loading,
  accent,
}: {
  label: string;
  value: string;
  loading?: boolean;
  accent?: "mint" | "default";
}) {
  return (
    <div className="min-w-0 rounded-lg border border-white/[0.06] bg-black px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </p>
      {loading ? (
        <div className="mt-1.5 h-6 w-16 animate-pulse rounded bg-zinc-800/80" />
      ) : (
        <p
          className={`mt-1 truncate text-base font-bold tabular-nums sm:text-lg ${
            accent === "mint" ? "text-mint" : "text-white"
          }`}
        >
          {value}
        </p>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] py-2.5 last:border-b-0">
      <span className="shrink-0 text-sm text-zinc-500">{label}</span>
      <span className="min-w-0 text-right text-sm font-medium text-white">{value}</span>
    </div>
  );
}

type SalesVolumeItem = {
  id: "7d" | "30d" | "90d";
  label: string;
  shortLabel: string;
  scope: string;
  value: number | null;
  loading: boolean;
};

function SalesScopeBadge({ label }: { label: string }) {
  return (
    <span
      className="inline-flex max-w-[5.25rem] shrink-0 items-center rounded-md border border-mint/35 bg-mint/10 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-mint sm:max-w-none sm:text-[10px]"
      title={label}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

function SalesVolumePanel({
  grade,
  sales7,
  sales30,
  sales90,
  salesAllGradesLoading = false,
  sales90Loading = false,
}: {
  grade: string;
  sales7: number | null;
  sales30: number | null;
  sales90: number | null;
  salesAllGradesLoading?: boolean;
  sales90Loading?: boolean;
}) {
  const items: SalesVolumeItem[] = [
    {
      id: "7d",
      label: "7 day sales",
      shortLabel: "7d sales",
      scope: "All grades",
      value: sales7,
      loading: salesAllGradesLoading,
    },
    {
      id: "30d",
      label: "30 day sales",
      shortLabel: "30d sales",
      scope: "All grades",
      value: sales30,
      loading: salesAllGradesLoading,
    },
    {
      id: "90d",
      label: "90 day sales",
      shortLabel: "90d sales",
      scope: grade,
      value: sales90,
      loading: salesAllGradesLoading || sales90Loading,
    },
  ];

  const anyLoading = items.some((i) => i.loading);
  const anyValue = items.some((i) => i.value != null);
  if (!anyLoading && !anyValue) return null;

  const renderTile = (item: SalesVolumeItem, layout: "scroll" | "grid") => {
    const tileWidth =
      layout === "scroll"
        ? "w-[min(72vw,13.5rem)] shrink-0 snap-start"
        : "min-w-0 w-full";

    if (item.loading) {
      return (
        <div
          key={`${layout}-${item.id}`}
          className={`animate-pulse rounded-xl border border-white/[0.06] bg-black px-3 py-3 sm:px-4 sm:py-3.5 ${tileWidth}`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <div className="h-3 w-16 rounded bg-zinc-800/80 sm:h-3.5 sm:w-24" />
            <div className="h-4 w-12 shrink-0 rounded-md bg-zinc-800/70 sm:w-14" />
          </div>
          <div className="mt-2.5 h-7 w-16 rounded bg-zinc-800/90 sm:mt-3 sm:h-8 sm:w-20" />
        </div>
      );
    }

    return (
      <div
        key={`${layout}-${item.id}`}
        className={`relative overflow-hidden rounded-xl border border-white/[0.08] bg-black px-3 py-3 sm:px-4 sm:py-3.5 ${tileWidth}`}
      >
        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
          <p className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white sm:text-[11px] sm:tracking-[0.1em]">
            <span className="block truncate sm:hidden">{item.shortLabel}</span>
            <span className="hidden truncate sm:block">{item.label}</span>
          </p>
          <SalesScopeBadge label={item.scope} />
        </div>

        <p className="mt-2 text-xl font-bold tabular-nums leading-none text-white sm:mt-2.5 sm:text-[1.75rem]">
          {item.value != null ? item.value.toLocaleString() : "—"}
        </p>
      </div>
    );
  };

  return (
    <div className="mt-4 min-w-0 border-t border-white/[0.06] pt-4">
      <div className="mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Sales activity
        </p>
      </div>

      <div className="mobile-scroll-x-contain -mx-3 flex gap-2 overflow-x-auto scroll-smooth snap-x snap-mandatory scroll-px-3 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:hidden">
        {items.map((item) => renderTile(item, "scroll"))}
      </div>

      <div className="hidden gap-2.5 sm:grid sm:grid-cols-3 sm:gap-3">
        {items.map((item) => renderTile(item, "grid"))}
      </div>
    </div>
  );
}

function Top100CardDetailContent() {
  const params = useParams<{ cardId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const cardId = decodeURIComponent(params.cardId ?? "");
  const category = searchParams.get("category") ?? "Pokemon";
  const initialGrade = searchParams.get("grade") ?? "PSA 10";
  const [grade, setGrade] = useState(initialGrade);
  const [chartDays, setChartDays] = useState<(typeof CHART_DAYS_OPTIONS)[number]>(30);

  const { data: top100Data } = useTop100(category);
  const top100Item = useMemo(
    () => top100Data?.items.find((i) => i.card_id === cardId) ?? null,
    [top100Data, cardId],
  );

  const dayChangesQuery = useTop100DayChanges(category, top100Data?.items ?? []);
  const dayChange = dayChangesQuery.data?.byCardId.get(cardId);

  const {
    card,
    gradeOptions,
    series,
    metrics,
    sales30,
    sales7,
    sales90,
    sales90Loading,
    salesAllGradesLoading,
    isLoading,
    isError,
    error,
    isFetching,
  } = useTop100CardDetail(cardId, grade, chartDays);

  const title = card
    ? top100CardTitle(card)
    : top100Item
      ? top100CardTitle(top100Item)
      : "Card";
  const subText = card
    ? top100CardSubText(card)
    : top100Item
      ? top100CardSubText(top100Item)
      : "";
  const imgUrl = resolveTop100ImageUrl(card?.image ?? top100Item?.image ?? null);

  const detailFields = useMemo(
    () =>
      buildTop100DetailFields({
        card: card ?? top100Item,
        fallbackCategory: category,
        title,
        subText,
      }),
    [card, top100Item, category, title, subText],
  );

  const ebaySearchQuery = useMemo(() => {
    const source = card ?? top100Item;
    return source ? buildTop100EbaySearchQuery(source) : title;
  }, [card, top100Item, title]);

  const ebaySearch = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(ebaySearchQuery)}`;

  const handleGradeChange = (next: string) => {
    setGrade(next);
    const p = new URLSearchParams(searchParams.toString());
    p.set("grade", next);
    router.replace(`/markets/top100/card/${encodeURIComponent(cardId)}?${p.toString()}`, {
      scroll: false,
    });
  };

  const chartLoading = isLoading || isFetching;
  const priceStats = buildChartPriceStats(metrics, chartDays, chartLoading);

  if (!cardId) {
    return (
      <div className="min-h-screen bg-black px-4 py-16 text-center text-sm text-zinc-500">
        Invalid card ID.
      </div>
    );
  }

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-black text-white">
      <div className="mx-auto w-full max-w-6xl min-w-0 px-3 pb-20 pt-6 max-[380px]:px-2 sm:px-6 sm:pb-24 sm:pt-10">
        {isError ? (
          <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-4 text-sm text-red-400">
            {error instanceof Error ? error.message : "Failed to load card data."}
          </div>
        ) : null}

        <header className="mb-6 sm:mb-8">
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl">
            {title}
          </h1>
          {subText ? (
            <p className="mt-2 text-base font-medium leading-snug text-white sm:mt-2.5 sm:text-lg">
              {subText}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-end justify-between gap-4 sm:mt-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Last close
                <span className="normal-case tracking-normal text-zinc-600"> · {grade}</span>
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-mint sm:text-4xl">
                {priceStats.last}
              </p>
            </div>
            {dayChangesQuery.data?.available ? (
              <div className="rounded-xl border border-white/[0.06] bg-black px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  vs yesterday
                </p>
                <div className="mt-1">
                  <Top100DayChangeBadge
                    change={dayChange}
                    loading={dayChangesQuery.isLoading}
                    variant="detail"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:gap-8">
          <div>
            <div className="relative mx-auto aspect-[3/4] w-full max-w-[280px] overflow-hidden rounded-2xl border border-white/[0.08] bg-black shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              {imgUrl ? (
                <div className="relative h-full w-full px-[12%] pt-[10%] pb-[6%]">
                  <Image
                    src={imgUrl}
                    alt={card?.description ?? top100Item?.description ?? title}
                    fill
                    className="object-contain"
                    style={IMAGE_FILTER}
                    sizes="280px"
                    unoptimized
                    priority
                  />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-zinc-700">
                  No image
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={ebaySearch}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/[0.1] bg-black px-3 py-2.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-white/[0.18] hover:text-white sm:text-sm"
              >
                Search on eBay
              </a>
            </div>
          </div>

          <div className="min-w-0">
            <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex flex-wrap items-center justify-end gap-2 border-b border-white/[0.06] px-3 py-3 sm:px-4">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={grade}
                    onChange={(e) => handleGradeChange(e.target.value)}
                    className="rounded-lg border border-white/[0.1] bg-black px-2.5 py-1.5 text-xs font-semibold text-white outline-none focus:border-mint/40 sm:text-sm"
                    aria-label="Grade"
                  >
                    {gradeOptions.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                  <div className="flex rounded-lg border border-white/[0.08] bg-black p-0.5">
                    {CHART_DAYS_OPTIONS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setChartDays(d)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors sm:text-xs ${
                          chartDays === d
                            ? "bg-mint/15 text-mint"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_50%_100%,rgba(16,211,51,0.1),transparent_60%)]" />
                <div className="relative h-[240px] px-2 pb-2 pt-3 sm:h-[300px]">
                  {chartLoading ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-mint/30 border-t-mint" />
                    </div>
                  ) : series.points.length > 0 ? (
                    <PortfolioValueChart
                      points={series.points}
                      xLabels={series.xLabels}
                      size="large"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-zinc-600">
                      No price history for this grade.
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-white/[0.06] px-3 py-4 sm:px-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                  {priceStats.cells.map((cell) => (
                    <PriceStat
                      key={cell.label}
                      label={cell.label}
                      value={cell.value}
                      loading={chartLoading}
                      accent={cell.accent}
                    />
                  ))}
                </div>

                <SalesVolumePanel
                  grade={grade}
                  sales7={sales7}
                  sales30={sales30}
                  sales90={sales90}
                  salesAllGradesLoading={salesAllGradesLoading}
                  sales90Loading={sales90Loading}
                />
              </div>
            </div>
          </div>
        </div>

        {detailFields.length > 0 ? (
          <section className="mt-8 sm:mt-10">
            <h2 className="mb-3 text-sm font-bold text-zinc-300 sm:text-base">Details</h2>
            <div className="rounded-2xl border border-white/[0.06] bg-black px-4 py-2 sm:px-5">
              {detailFields.map((row) => (
                <DetailRow key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function buildChartPriceStats(
  metrics: Top100PriceMetrics | null,
  chartDays: number,
  loading: boolean,
): {
  last: string;
  cells: Array<{ label: string; value: string; accent?: "mint" | "default" }>;
} {
  if (loading || !metrics) {
    return {
      last: "…",
      cells: [
        { label: `${chartDays}d change`, value: "—", accent: "mint" },
        { label: `${chartDays}d avg`, value: "—" },
        { label: `${chartDays}d high`, value: "—" },
        { label: `${chartDays}d low`, value: "—" },
      ],
    };
  }

  const changeAccent: "mint" | "default" =
    metrics.changePct != null && metrics.changePct < 0 ? "default" : "mint";

  return {
    last: formatTop100Usd(metrics.currentPrice),
    cells: [
      {
        label: `${chartDays}d change`,
        value: formatChangePct(metrics.changePct),
        accent: changeAccent,
      },
      { label: `${chartDays}d avg`, value: formatTop100Usd(metrics.avgPrice) },
      { label: `${chartDays}d high`, value: formatTop100Usd(metrics.maxPrice) },
      { label: `${chartDays}d low`, value: formatTop100Usd(metrics.minPrice) },
    ],
  };
}

export default function Top100CardDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black px-4 py-16 text-center text-sm text-zinc-500">
          Loading card…
        </div>
      }
    >
      <Top100CardDetailContent />
    </Suspense>
  );
}
