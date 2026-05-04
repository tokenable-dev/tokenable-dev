"use client";

import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { CollectionCoverFrame } from "@/components/marketplace/CollectionCoverFrame";
import {
  CollectionMetadataExpandable,
  type CollectionMetadataExpandableProps,
} from "@/components/marketplace/CollectionMetadataExpandable";
import { CollectionPriceHistoryPlaceholder } from "@/components/marketplace/CollectionPriceHistoryPlaceholder";

export interface CollectionOverviewStat {
  label: string;
  value: string;
  /** e.g. positive / negative / neutral for color hint */
  tone?: "up" | "down" | "neutral";
  sub?: string;
}

export interface CollectionOverviewBoardProps {
  title: string;
  subtitle?: string | null;
  badgeLabel?: string;
  imageUrl: string | null;
  metadataRows: { label: string; value: string }[];
  /** 비우면 헤더 오른쪽 인라인 스탯 숨김 */
  stats: CollectionOverviewStat[];
  /** 차트 바로 위 (Current Price / Change / Volatility / MCap 등) */
  chartMetricsRow?: ReactNode;
  /** Depth book (optional — e.g. rendered in a unified trade section below) */
  orderBook?: ReactNode;
  /** Buy / sell ticket — optional; pairs with orderBook when used in overview */
  tradeTicket?: ReactNode;
  listingCount: number;
  /** When set, replaces the decorative price placeholder */
  priceChart?: ReactNode;
  /** Desktop: sits beside the chart (narrow order book), middle column. */
  orderBookNextToChart?: ReactNode;
  /** Right column: buy / sell / orders only (no book). */
  tradePanel?: ReactNode;
  /** Hero cover: hover magnifier lens */
  heroCoverLoupe?: boolean;
  /** Extra collection fields + expand — omit for plain metadata grid only */
  metadataExpand?: Omit<CollectionMetadataExpandableProps, "metadataRows">;
  /** e.g. external market strip — rendered under metadata on the left */
  leftColumnFooter?: ReactNode;
}

function withFlushProp(node: ReactNode): ReactNode {
  if (!isValidElement(node)) return node;
  return cloneElement(node as ReactElement<{ flush?: boolean }>, { flush: true });
}

function HeaderInlineStat({ stat }: { stat: CollectionOverviewStat }) {
  const toneClass =
    stat.tone === "up"
      ? "text-emerald-400"
      : stat.tone === "down"
        ? "text-rose-400"
        : "text-zinc-100";
  return (
    <div className="flex min-w-[4.25rem] shrink-0 flex-col gap-0.5 sm:min-w-[5rem]">
      <p className="text-[9px] font-medium uppercase tracking-wide text-zinc-500 whitespace-nowrap">
        {stat.label}
      </p>
      <p className={`text-sm font-semibold tabular-nums leading-tight ${toneClass}`}>
        {stat.value}
      </p>
      {stat.sub ? (
        <p className="text-[9px] leading-snug text-zinc-600 max-w-[8.5rem] truncate sm:max-w-none">
          {stat.sub}
        </p>
      ) : null}
    </div>
  );
}

export function CollectionOverviewBoard({
  title,
  subtitle,
  badgeLabel = "Collection",
  imageUrl,
  metadataRows,
  stats,
  chartMetricsRow,
  orderBook,
  tradeTicket,
  listingCount,
  priceChart,
  orderBookNextToChart,
  tradePanel,
  heroCoverLoupe = false,
  metadataExpand,
  leftColumnFooter,
}: CollectionOverviewBoardProps) {
  const hasBookColumn = orderBook != null || tradeTicket != null;
  const exchangeTriple = tradePanel != null && orderBookNextToChart != null;

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-gray-800/80 bg-gradient-to-b from-[#0a0d12] via-[#07090c] to-[#050607] shadow-[0_28px_64px_-32px_rgba(0,0,0,0.9)]"
      aria-label="Collection overview"
    >
      <div
        className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-emerald-500/[0.07] blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 bottom-0 h-56 w-56 rounded-full bg-teal-500/[0.06] blur-3xl"
        aria-hidden
      />

      <div className="relative border-b border-gray-800/70 px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-0">
          <div className="flex min-w-0 flex-1 items-start justify-between gap-3 lg:shrink-0 lg:basis-[min(100%,280px)] lg:flex-col lg:justify-center xl:basis-[min(100%,320px)]">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center rounded-md border border-amber-500/25 bg-amber-500/[0.08] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200/90">
                  {badgeLabel}
                </span>
                <span className="text-[10px] text-zinc-500 tabular-nums">
                  {listingCount} listing{listingCount === 1 ? "" : "s"}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-semibold tracking-[-0.02em] text-white text-balance leading-snug">
                {title}
              </h1>
              {subtitle ? (
                <p className="text-[11px] text-zinc-500 leading-snug">{subtitle}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg border border-zinc-700/90 bg-white/[0.03] p-1.5 text-zinc-500 hover:text-amber-200/90 hover:border-amber-500/30 transition-colors lg:hidden"
              aria-label="Favorite (coming soon)"
              title="Favorite — coming soon"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>
          </div>

          {stats.length > 0 ? (
            <>
              <div
                className="hidden lg:block w-px shrink-0 self-stretch bg-zinc-800/90 mx-5 xl:mx-6"
                aria-hidden
              />

              <div className="min-w-0 flex-1 border-t border-zinc-800/80 pt-3 lg:flex lg:min-w-0 lg:items-center lg:border-t-0 lg:pt-0">
                <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-0.5 scrollbar-platform sm:gap-6 lg:mx-0 lg:flex-wrap lg:gap-x-7 lg:gap-y-2 lg:overflow-visible lg:px-0 lg:pb-0">
                  {stats.map((s) => (
                    <HeaderInlineStat key={s.label} stat={s} />
                  ))}
                </div>
              </div>
            </>
          ) : null}

          <button
            type="button"
            className="hidden lg:flex shrink-0 self-center rounded-lg border border-zinc-700/90 bg-white/[0.03] p-2 text-zinc-500 hover:text-amber-200/90 hover:border-amber-500/30 transition-colors"
            aria-label="Favorite (coming soon)"
            title="Favorite — coming soon"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        </div>
      </div>

      <div
        className={`relative grid gap-6 lg:gap-8 p-4 sm:p-6 lg:px-8 lg:pt-8 lg:pb-6 lg:items-start ${
          exchangeTriple
            ? "lg:grid-cols-[minmax(180px,240px)_minmax(0,1fr)]"
            : hasBookColumn
              ? "lg:grid-cols-[minmax(180px,240px)_minmax(0,1fr)_minmax(220px,300px)]"
              : "lg:grid-cols-[minmax(180px,240px)_minmax(0,1fr)]"
        }`}
      >
        {/* Left: preview + meta */}
        <div className="flex flex-col items-center lg:items-stretch gap-4">
          <div className="flex justify-center lg:justify-start">
            {imageUrl ? (
              <CollectionCoverFrame
                imageUrl={imageUrl}
                alt=""
                variant="hero"
                heroLoupe={heroCoverLoupe}
                className="relative z-[1] shrink-0"
              />
            ) : (
              <div className="flex aspect-[3/4] w-full max-w-[min(100%,260px)] items-center justify-center rounded-2xl border border-gray-800/90 bg-gradient-to-br from-gray-900/90 to-gray-950 p-6 text-center text-[12px] text-gray-500">
                No preview
              </div>
            )}
          </div>
          {metadataExpand ? (
            <CollectionMetadataExpandable
              metadataRows={metadataRows}
              {...metadataExpand}
            />
          ) : metadataRows.length > 0 ? (
            <dl className="w-full grid grid-cols-2 gap-2 text-[13px]">
              {metadataRows.map((row) => (
                <div
                  key={row.label}
                  className="rounded-lg border border-gray-800/80 bg-black/25 px-2.5 py-2 col-span-2 sm:col-span-1"
                >
                  <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                    {row.label}
                  </dt>
                  <dd className="mt-0.5 text-gray-100 leading-snug break-words">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {leftColumnFooter}
        </div>

        {/* Middle: chart (+ order book in exchange layout). Metrics sit above the chart only, not the book/trade column. */}
        <div className="min-w-0 flex flex-col gap-4 items-stretch w-full">
          {exchangeTriple ? (
            <div
              className="flex w-full min-w-0 flex-col gap-4 max-xl:gap-4 xl:h-[min(720px,74svh)] xl:max-h-[min(720px,74svh)] xl:min-h-[min(720px,74svh)] xl:flex-row xl:items-stretch xl:gap-4"
            >
              {/* Chart first on narrow screens (readable size); xl+ shares fixed row with book+trade */}
              <div className="order-1 flex min-w-0 flex-1 flex-col gap-3 xl:order-1 xl:h-full xl:min-h-0">
                {chartMetricsRow != null ? (
                  <div className="w-full min-w-0 shrink-0">{chartMetricsRow}</div>
                ) : null}
                <div className="flex w-full min-w-0 min-h-0 flex-1 flex-col xl:h-full xl:min-h-0">
                  {priceChart ?? (
                    <CollectionPriceHistoryPlaceholder className="w-full min-h-[360px] max-xl:min-h-[min(400px,50svh)] xl:h-full xl:min-h-0" />
                  )}
                </div>
              </div>
              {/*
                Book + trade: fixed max width so the chart can use the rest of the row.
                Two equal columns so the book matches the order (trade) pane width — no extra book-wide bias.
              */}
              <div className="order-2 flex w-full min-w-0 max-w-full flex-col xl:order-2 xl:h-full xl:min-h-0 xl:w-[min(100%,min(440px,max(360px,28vw)))] xl:shrink-0 xl:self-stretch xl:basis-[min(100%,min(440px,max(360px,28vw)))]">
                <div className="grid h-full min-h-0 w-full min-w-0 grid-cols-2 grid-rows-1 overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-950 shadow-[0_14px_44px_-22px_rgba(0,0,0,0.65)] divide-x divide-zinc-800/80 max-xl:min-h-[min(480px,58dvh)] xl:h-full xl:max-h-full">
                  <div className="flex min-h-[min(220px,32dvh)] min-w-0 flex-col overflow-hidden xl:h-full xl:max-h-full xl:min-h-0">
                    {withFlushProp(orderBookNextToChart)}
                  </div>
                  <div className="flex min-h-0 min-w-0 flex-col overflow-hidden xl:h-full xl:max-h-full xl:min-h-0">
                    {withFlushProp(tradePanel)}
                  </div>
                </div>
              </div>
            </div>
          ) : tradePanel != null ? (
            <div className="w-full max-w-6xl mx-auto grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(320px,min(440px,36vw))] gap-4 min-w-0 items-start">
              <div className="flex min-w-0 w-full flex-col gap-3">
                {chartMetricsRow != null ? (
                  <div className="w-full min-w-0 shrink-0">{chartMetricsRow}</div>
                ) : null}
                {priceChart ?? (
                  <CollectionPriceHistoryPlaceholder className="min-h-[240px] sm:min-h-[300px] w-full" />
                )}
              </div>
              <div className="min-w-0 w-full xl:justify-self-stretch xl:sticky xl:top-4">
                {tradePanel}
              </div>
            </div>
          ) : (
            <div className="flex w-full max-w-3xl mx-auto min-w-0 flex-col gap-3">
              {chartMetricsRow != null ? (
                <div className="w-full min-w-0 shrink-0">{chartMetricsRow}</div>
              ) : null}
              {priceChart ?? (
                <CollectionPriceHistoryPlaceholder className="min-h-[240px] sm:min-h-[280px] w-full" />
              )}
            </div>
          )}
        </div>

        {hasBookColumn && (
          <div className="min-w-0 w-full max-w-[300px] lg:justify-self-end flex flex-col gap-0 lg:sticky lg:top-4">
            {orderBook != null && <div className="min-w-0 min-h-0">{orderBook}</div>}
            {tradeTicket != null && (
              <div className="mt-4 rounded-xl border border-gray-800/80 bg-[#14171f] px-3 py-3 sm:px-4 sm:py-4">
                {tradeTicket}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
