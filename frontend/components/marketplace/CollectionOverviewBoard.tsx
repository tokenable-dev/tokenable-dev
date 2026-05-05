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
import {
  COLLECTION_MARKET_CLUSTER_BEZEL,
  COLLECTION_MARKET_CLUSTER_MAT,
  COLLECTION_MARKET_SPLIT_CHROME,
} from "@/components/marketplace/collectionOverviewChrome";

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
  /** Asset-style headline (card name); use with headlineTitleLayout for badges + meta strip */
  headlineTitle?: string | null;
  /** Set / product line under the card name (shown at top — not duplicated under cover). */
  headlineSetLine?: string | null;
  /** Supplementary line under set: e.g. `#85 · variant` — optional when {@link headlineInfoTags} covers it. */
  headlineMetaStrip?: string | null;
  /** Identifier chips under title / set (card #, variant, pop, grade without mint badge). */
  headlineInfoTags?: { id: string; text: string; title?: string }[] | null;
  /** Amber capsule (e.g. category) */
  categoryBadge?: string | null;
  /** Mint capsule (e.g. PSA tier) */
  gradeBadge?: string | null;
  /** When true with {@link headlineTitle}, renders reference header layout instead of subtitle-under-title classic block */
  headlineTitleLayout?: boolean;
  badgeLabel?: string;
  imageUrl: string | null;
  metadataRows: { label: string; value: string }[];
  /** 비우면 헤더 오른쪽 인라인 스탯 숨김 */
  stats: CollectionOverviewStat[];
  /** 차트 바로 위 (Current Price / Change 등) — exchange 트리플에서는 차트 열 전용 타일만 넣음 */
  chartMetricsRow?: ReactNode;
  /** Volatility / MCap — exchange 트리플일 때 오더북·트레이드 열 위; xl 이상만 표시(모바일·좁은 뷰포트에서는 숨김). */
  bookColumnMetricsRow?: ReactNode;
  /** Depth book (optional — e.g. rendered in a unified trade section below) */
  orderBook?: ReactNode;
  /** Buy / sell ticket — optional; pairs with orderBook when used in overview */
  tradeTicket?: ReactNode;
  listingCount: number;
  /** When false, hides the "N listings" line in the header (e.g. collection details). */
  showListingSummary?: boolean;
  /** When set, replaces the decorative price placeholder */
  priceChart?: ReactNode;
  /** Desktop: sits beside the chart (narrow order book), middle column. */
  orderBookNextToChart?: ReactNode;
  /** Right column: buy / sell / orders only (no book). */
  tradePanel?: ReactNode;
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
  headlineTitle,
  headlineSetLine,
  headlineMetaStrip,
  headlineInfoTags,
  categoryBadge,
  gradeBadge,
  headlineTitleLayout = false,
  badgeLabel = "Collection",
  imageUrl,
  metadataRows,
  stats,
  chartMetricsRow,
  bookColumnMetricsRow,
  orderBook,
  tradeTicket,
  listingCount,
  showListingSummary = true,
  priceChart,
  orderBookNextToChart,
  tradePanel,
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
          <div className="flex min-w-0 flex-1 items-start justify-between gap-3 lg:shrink-0 lg:basis-[min(100%,min(560px,52vw))] lg:flex-col lg:justify-center xl:basis-[min(100%,min(620px,48vw))]">
            <div className="min-w-0 space-y-2">
              {headlineTitleLayout && headlineTitle ? (
                <>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      {categoryBadge ? (
                        <span className="inline-flex shrink-0 items-center rounded-md border border-amber-400/40 bg-amber-500/[0.22] px-2.5 py-1 text-[11px] font-semibold capitalize tracking-wide text-amber-50">
                          {categoryBadge}
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center rounded-md border border-amber-500/25 bg-amber-500/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">
                          {badgeLabel}
                        </span>
                      )}
                      {gradeBadge ? (
                        <span className="inline-flex shrink-0 items-center rounded-md border border-mint-deep/45 bg-mint/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-mint ring-1 ring-mint-deep/25">
                          {gradeBadge}
                        </span>
                      ) : null}
                    </div>
                    {showListingSummary ? (
                      <span className="ml-auto shrink-0 text-[10px] font-medium uppercase tracking-wide text-zinc-500 tabular-nums">
                        {listingCount} listing{listingCount === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>
                  <h1 className="mt-2 text-xl font-bold tracking-tight text-white text-balance leading-snug sm:text-2xl lg:text-[1.85rem]">
                    {headlineTitle}
                  </h1>
                  {headlineSetLine?.trim() ? (
                    <p className="mt-2 text-[14px] sm:text-[15px] leading-snug text-zinc-200/95 text-pretty font-medium">
                      {headlineSetLine.trim()}
                    </p>
                  ) : null}
                  {headlineMetaStrip?.trim() ? (
                    <p className="mt-1 text-[13px] leading-snug text-zinc-400 text-pretty">
                      {headlineMetaStrip.trim()}
                    </p>
                  ) : null}
                  {headlineInfoTags && headlineInfoTags.length > 0 ? (
                    <div
                      className="mt-2 flex flex-wrap gap-2"
                      aria-label="Card identifiers"
                    >
                      {headlineInfoTags.map((tag) => (
                        <span
                          key={tag.id}
                          title={tag.title}
                          className="inline-flex max-w-[min(100%,18rem)] truncate rounded-full border border-zinc-600/70 bg-zinc-950/90 px-2.5 py-1 text-[11px] font-medium leading-tight text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                        >
                          {tag.text}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <span className="sr-only">{title}</span>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="inline-flex items-center rounded-md border border-amber-500/25 bg-amber-500/[0.08] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200/90">
                      {badgeLabel}
                    </span>
                    {showListingSummary ? (
                      <span className="text-[10px] text-zinc-500 tabular-nums">
                        {listingCount} listing{listingCount === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>
                  <h1 className="text-lg sm:text-xl font-semibold tracking-[-0.02em] text-white text-balance leading-snug">
                    {title}
                  </h1>
                  {subtitle ? (
                    <p className="text-[11px] text-zinc-500 leading-snug">{subtitle}</p>
                  ) : null}
                </>
              )}
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
            ? "lg:grid-cols-[minmax(240px,min(400px,36vw))_minmax(0,1fr)]"
            : hasBookColumn
              ? "lg:grid-cols-[minmax(260px,min(460px,40vw))_minmax(0,1fr)_minmax(220px,300px)]"
              : "lg:grid-cols-[minmax(260px,min(460px,40vw))_minmax(0,1fr)]"
        }`}
      >
        {/* Left: preview + meta */}
        {/* `items-center` would shrink-track cross-axis width on mobile unless inner rows are `w-full` — otherwise hero `w-full`/aspect-ratio collapses. */}
        <div className="flex w-full min-w-0 flex-col items-center lg:items-stretch gap-4">
          <div className="flex w-full min-w-0 justify-center lg:justify-start">
            {imageUrl ? (
              <CollectionCoverFrame
                imageUrl={imageUrl}
                alt=""
                variant="hero"
                className="relative z-[1] shrink-0"
              />
            ) : (
              <div className="flex aspect-[3/4] w-full max-w-[min(100%,340px)] sm:max-w-[min(100%,376px)] lg:max-w-[min(400px,36vw)] xl:max-w-[min(420px,32vw)] items-center justify-center rounded-2xl border border-gray-800/90 bg-gradient-to-br from-gray-900/90 to-gray-950 p-6 text-center text-[12px] text-gray-500">
                No preview
              </div>
            )}
          </div>
          {metadataExpand ? (
            <CollectionMetadataExpandable metadataRows={metadataRows} {...metadataExpand} />
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

        {/* Middle: chart (+ book in exchange layout). Triple: price tiles over chart column; Vol/Cap over book+trade column. */}
        <div className="min-w-0 flex flex-col gap-2.5 items-stretch w-full sm:gap-3">
          {exchangeTriple ? (
            <div className={COLLECTION_MARKET_CLUSTER_BEZEL}>
              <div className={COLLECTION_MARKET_CLUSTER_MAT}>
                <div
                  className={[
                    "flex min-w-0 w-full flex-col gap-3 max-xl:gap-3",
                    "xl:grid xl:min-h-0 xl:gap-x-3 xl:gap-y-3",
                    "xl:grid-cols-[minmax(0,1fr)_min(100%,min(440px,max(360px,28vw)))]",
                  ].join(" ")}
                >
                  {chartMetricsRow != null || bookColumnMetricsRow != null ? (
                    bookColumnMetricsRow != null ? (
                      <>
                        <div className="order-1 min-w-0 shrink-0 xl:col-start-1 xl:row-start-1">
                          {chartMetricsRow != null ? (
                            <div className="w-full min-w-0">{chartMetricsRow}</div>
                          ) : null}
                        </div>
                        <div className="order-3 hidden min-w-0 shrink-0 xl:col-start-2 xl:row-start-1 xl:block">
                          <div className="w-full min-w-0">{bookColumnMetricsRow}</div>
                        </div>
                      </>
                    ) : (
                      <div className="order-1 min-w-0 xl:col-span-2 xl:row-start-1">
                        {chartMetricsRow}
                      </div>
                    )
                  ) : null}

                  <div className="order-2 flex min-h-0 min-w-0 flex-col xl:col-start-1 xl:row-start-2 xl:h-[min(calc(min(420px,_32vw)*4/3*0.86+1.25rem),min(478px,_48svh))] xl:max-h-[min(478px,_48svh)]">
                    <div className="flex h-full min-h-0 w-full flex-1 flex-col xl:h-full">
                      {priceChart ?? (
                        <CollectionPriceHistoryPlaceholder className="w-full min-h-[128px] max-xl:min-h-[min(152px,_20svh)] xl:h-full xl:min-h-0" />
                      )}
                    </div>
                  </div>

                  <div className="order-4 flex min-h-0 w-full min-w-0 max-w-full flex-col self-stretch xl:col-start-2 xl:row-start-2 xl:h-[min(calc(min(420px,_32vw)*4/3*0.86+1.25rem),min(478px,_48svh))] xl:max-h-[min(478px,_48svh)] xl:w-auto xl:max-w-none xl:shrink-0">
                    <div
                      className={`grid h-full min-h-[min(140px,_22dvh)] w-full min-w-0 grid-cols-2 grid-rows-1 overflow-hidden max-xl:min-h-[min(176px,_25dvh)] xl:min-h-0 xl:h-full xl:max-h-full ${COLLECTION_MARKET_SPLIT_CHROME}`}
                    >
                      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden max-xl:min-h-[min(128px,_18dvh)] xl:h-full xl:max-h-full">
                        {withFlushProp(orderBookNextToChart)}
                      </div>
                      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden xl:h-full xl:max-h-full">
                        {withFlushProp(tradePanel)}
                      </div>
                    </div>
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
                  <CollectionPriceHistoryPlaceholder className="min-h-[180px] sm:min-h-[225px] w-full" />
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
                <CollectionPriceHistoryPlaceholder className="min-h-[180px] sm:min-h-[210px] w-full" />
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
