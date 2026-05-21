"use client";

import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { IBM_Plex_Sans } from "next/font/google";
import { CollectionCoverFrame } from "@/components/marketplace/CollectionCoverFrame";
import {
  CollectionMetadataExpandable,
  type CollectionMetadataExpandableProps,
} from "@/components/marketplace/CollectionMetadataExpandable";
import { CollectionPriceHistoryPlaceholder } from "@/components/marketplace/CollectionPriceHistoryPlaceholder";
import {
  COLLECTION_DETAILS_BG_CLASS,
  COLLECTION_DETAILS_BORDER_ALL,
  COLLECTION_DETAILS_BORDER_B,
  COLLECTION_DETAILS_BORDER_T,
  COLLECTION_MARKET_CLUSTER_BEZEL,
  COLLECTION_MARKET_CLUSTER_MAT,
  COLLECTION_MARKET_SPLIT_CHROME,
  COLLECTION_EXCHANGE_ORDER_BOOK_FRAME,
} from "@/components/marketplace/collectionOverviewChrome";
import { CollectionOrderBookVisibilityToggle } from "@/components/marketplace/CollectionOrderBookVisibilityToggle";

const collectionHeroFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

/** Outline tags (Pokemon / PSA / POP) — neutral border, no fill. */
const HEADLINE_OUTLINE_TAG =
  "inline-flex h-[26px] min-h-[26px] shrink-0 items-center justify-center rounded border border-[#a2a2a2] bg-transparent px-[10px] py-1 text-sm font-normal leading-none text-white";

/** Secondary lines under the hero title (set, meta, badges, chips). */
const HEADLINE_NAME_TEXT = "text-[15px] leading-snug tracking-normal";

/** Collection name: one line with ellipsis when needed; larger than secondary copy. */
const HEADLINE_TITLE_ONE_LINE =
  "w-full min-w-0 truncate whitespace-nowrap text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-[1.85rem] xl:text-[2.125rem] leading-[1.15]";

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
  /** Identifier chips under title / set (card #, variant, etc. — not grade; Pop uses {@link populationBadge}). */
  headlineInfoTags?: { id: string; text: string; title?: string }[] | null;
  /** Amber capsule (e.g. category) */
  categoryBadge?: string | null;
  /** Mint capsule (e.g. PSA tier) */
  gradeBadge?: string | null;
  /** Zinc capsule — PSA population (e.g. `Pop · 47,911`), same row as category + grade */
  populationBadge?: string | null;
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
  /**
   * Exchange layout only: row directly under the chart (e.g. price strip + Buy/Sell),
   * still in the chart column before the order book track.
   */
  exchangeChartFooter?: ReactNode;
  /** Desktop: sits beside the chart (narrow order book), middle column. */
  orderBookNextToChart?: ReactNode;
  /** Right column: buy / sell / orders only (no book). */
  tradePanel?: ReactNode;
  /**
   * Exchange triple layout only: show the order book column in-grid; mount {@link tradePanel}
   * after the split (host should use fixed / dock UI — e.g. {@link CollectionTradingTabs} `exchangeDock`).
   */
  exchangeDockTradePanel?: boolean;
  /** Extra collection fields + expand — omit for plain metadata grid only */
  metadataExpand?: Omit<CollectionMetadataExpandableProps, "metadataRows">;
  /** Exchange layout: rendered above the order book + trade split (right track). */
  exchangeRightStackTop?: ReactNode;
  /**
   * With {@link onShowOrderBookChange}: order-book visibility toggle is anchored to the top-right of the
   * exchange cluster bezel (not in document flow); when false the order book + trade column is hidden and
   * the chart spans that width (xl+).
   */
  showOrderBook?: boolean;
  onShowOrderBookChange?: (next: boolean) => void;
  /** e.g. external market strip — rendered under metadata on the left */
  leftColumnFooter?: ReactNode;
  /** Placed directly under the representative card image (before hero actions + metadata). */
  belowCover?: ReactNode;
  /**
   * Exchange triple only: block directly under the chart/order-book cluster (e.g. individual listings grid).
   */
  exchangeBelowChart?: ReactNode;
  /**
   * With {@link headlineTitleLayout}: hide the large in-banner title block; keep outline tags.
   * Use when the primary title is rendered under the cover (e.g. details tab card).
   */
  suppressHeadlineBanner?: boolean;
  heroActions?: ReactNode;
}

function withFlushProp(node: ReactNode): ReactNode {
  if (!isValidElement(node)) return node;
  return cloneElement(node as ReactElement<{ flush?: boolean }>, { flush: true });
}

function formatPopulationHeadlineTag(raw: string): string {
  const t = raw.trim();
  const m = /^Pop\s*[·.:]\s*/i.exec(t);
  const num = m ? t.slice(m[0].length).trim() : t.replace(/^pop\s*/i, "").trim();
  return num ? `POP ${num}` : t;
}

/** One subtitle under the title: set · meta · card # (matches reference pipe layout). */
function buildHeadlineSubtitleLine(
  setLine: string | null | undefined,
  metaStrip: string | null | undefined,
  infoTags: { id: string; text: string }[] | null | undefined,
): string | null {
  const parts: string[] = [];
  const s = setLine?.trim();
  if (s) parts.push(s);
  const m = metaStrip?.trim();
  if (m) parts.push(m);
  const cardNo = infoTags?.find((t) => t.id === "cardno")?.text?.trim();
  if (cardNo) parts.push(cardNo);
  return parts.length > 0 ? parts.join(" | ") : null;
}

function HeaderInlineStat({ stat }: { stat: CollectionOverviewStat }) {
  const toneClass =
    stat.tone === "up"
      ? "text-mint"
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
  populationBadge,
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
  exchangeChartFooter,
  orderBookNextToChart,
  tradePanel,
  exchangeDockTradePanel = false,
  metadataExpand,
  exchangeRightStackTop,
  showOrderBook = true,
  onShowOrderBookChange,
  leftColumnFooter,
  heroActions,
  belowCover,
  exchangeBelowChart,
  suppressHeadlineBanner = false,
}: CollectionOverviewBoardProps) {
  const hasBookColumn = orderBook != null || tradeTicket != null;
  const exchangeTriple = tradePanel != null && orderBookNextToChart != null;
  const orderBookToggleEnabled = onShowOrderBookChange != null;
  const orderBookColumnVisible = !orderBookToggleEnabled || showOrderBook;

  const headlineSubtitleLine =
    headlineTitleLayout && headlineTitle
      ? buildHeadlineSubtitleLine(headlineSetLine, headlineMetaStrip, headlineInfoTags ?? null)
      : null;

  return (
    <section
      className={`relative overflow-hidden rounded-2xl ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS} shadow-[0_28px_64px_-32px_rgba(0,0,0,0.9)]`}
      aria-label="Collection overview"
    >
      <div className={`relative px-3.5 pt-3 pb-3.5 sm:px-6 sm:py-4 lg:px-8 ${COLLECTION_DETAILS_BORDER_B}`}>
        <div className="flex flex-col gap-3 sm:gap-3 lg:flex-row lg:items-stretch lg:gap-0">
          <div className="flex min-w-0 flex-1 items-start justify-between gap-3 lg:shrink-0 lg:basis-[min(100%,min(560px,52vw))] lg:flex-col lg:justify-center xl:basis-[min(100%,min(620px,48vw))]">
            <div className="min-w-0 space-y-2">
              {headlineTitleLayout && headlineTitle ? (
                suppressHeadlineBanner ? (
                  <>
                    <h1 className="sr-only">{headlineTitle}</h1>
                    <div
                      className={`${collectionHeroFont.className} flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-x-4`}
                    >
                      <div
                        className="flex w-full shrink-0 flex-wrap items-center justify-center gap-2.5 sm:w-auto sm:justify-start"
                        aria-label="Collection tags"
                      >
                        {categoryBadge ? (
                          <span className={HEADLINE_OUTLINE_TAG}>{categoryBadge}</span>
                        ) : (
                          <span className={HEADLINE_OUTLINE_TAG}>{badgeLabel}</span>
                        )}
                        {gradeBadge ? <span className={HEADLINE_OUTLINE_TAG}>{gradeBadge}</span> : null}
                        {populationBadge?.trim() ? (
                          <span
                            className={HEADLINE_OUTLINE_TAG}
                            title="PSA population for this grade (reported)"
                          >
                            {formatPopulationHeadlineTag(populationBadge)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span className="sr-only">{title}</span>
                  </>
                ) : (
                <>
                  <div
                    className={`${collectionHeroFont.className} flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-x-4`}
                  >
                    <div className="min-w-0 flex-1">
                      <h1
                        className="break-words text-2xl font-bold leading-snug tracking-normal text-white sm:text-3xl sm:leading-[1.35] lg:text-[35px] lg:leading-[1.4]"
                        title={headlineTitle}
                      >
                        {headlineTitle}
                      </h1>
                      {headlineSubtitleLine ? (
                        <p className="mt-1 max-w-full text-[16px] font-normal leading-[1.4] tracking-normal text-zinc-400 sm:mt-1.5">
                          {headlineSubtitleLine}
                        </p>
                      ) : null}
                    </div>
                    <div
                      className="flex w-full shrink-0 flex-wrap items-center justify-center gap-2.5 sm:w-auto sm:justify-end sm:pt-[0.45rem]"
                      aria-label="Collection tags"
                    >
                      {categoryBadge ? (
                        <span className={HEADLINE_OUTLINE_TAG}>{categoryBadge}</span>
                      ) : (
                        <span className={HEADLINE_OUTLINE_TAG}>{badgeLabel}</span>
                      )}
                      {gradeBadge ? <span className={HEADLINE_OUTLINE_TAG}>{gradeBadge}</span> : null}
                      {populationBadge?.trim() ? (
                        <span
                          className={HEADLINE_OUTLINE_TAG}
                          title="PSA population for this grade (reported)"
                        >
                          {formatPopulationHeadlineTag(populationBadge)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className="sr-only">{title}</span>
                </>
                )
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={`inline-flex items-center rounded-md border border-amber-500/25 bg-amber-500/[0.08] px-1.5 py-0.5 ${HEADLINE_NAME_TEXT} font-semibold uppercase text-amber-200/90`}
                    >
                      {badgeLabel}
                    </span>
                    {showListingSummary ? (
                      <span
                        className={`${HEADLINE_NAME_TEXT} text-zinc-500 tabular-nums`}
                      >
                        {listingCount} listing{listingCount === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>
                  <h1 className={HEADLINE_TITLE_ONE_LINE} title={title}>
                    {title}
                  </h1>
                  {subtitle ? (
                    <p className={`${HEADLINE_NAME_TEXT} text-zinc-500`}>{subtitle}</p>
                  ) : null}
                </>
              )}
            </div>
            <button
              type="button"
              className={`shrink-0 rounded-lg ${COLLECTION_DETAILS_BORDER_ALL} bg-white/[0.03] p-1.5 text-zinc-500 hover:text-amber-200/90 hover:border-amber-500/30 transition-colors lg:hidden`}
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
                className="hidden lg:block w-px shrink-0 self-stretch bg-[rgba(11,13,16,1)] mx-5 xl:mx-6"
                aria-hidden
              />

              <div className={`min-w-0 flex-1 pt-3 lg:flex lg:min-w-0 lg:items-center lg:pt-0 ${COLLECTION_DETAILS_BORDER_T} lg:border-t-0`}>
                <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-0.5 sm:gap-6 lg:mx-0 lg:flex-wrap lg:gap-x-7 lg:gap-y-2 lg:overflow-visible lg:px-0 lg:pb-0">
                  {stats.map((s) => (
                    <HeaderInlineStat key={s.label} stat={s} />
                  ))}
                </div>
              </div>
            </>
          ) : null}

          <button
            type="button"
            className={`hidden lg:flex shrink-0 self-center rounded-lg ${COLLECTION_DETAILS_BORDER_ALL} bg-white/[0.03] p-2 text-zinc-500 hover:text-amber-200/90 hover:border-amber-500/30 transition-colors`}
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
        className={`relative grid px-3 pt-3.5 pb-4 sm:p-6 lg:px-8 lg:pt-6 lg:pb-6 ${
          exchangeTriple
            ? "gap-3 sm:gap-4 lg:gap-x-5 lg:gap-y-0 lg:items-start lg:grid-cols-[307px_minmax(0,1fr)]"
              : hasBookColumn
                ? "lg:items-start gap-6 lg:gap-8 lg:grid-cols-[minmax(260px,min(307px,40vw))_minmax(0,1fr)_minmax(220px,300px)]"
                : "lg:items-start gap-6 lg:gap-8 lg:grid-cols-[minmax(260px,min(307px,40vw))_minmax(0,1fr)]"
        }`}
      >
        {/* Left: preview + meta — exchange: start-align with chart cluster for one horizontal band */}
        {/* `items-center` would shrink-track cross-axis width on mobile unless inner rows are `w-full` — otherwise hero `w-full`/aspect-ratio collapses. */}
        <div
          className={`flex min-w-0 flex-col gap-3 sm:gap-4 ${
            exchangeTriple
              ? "w-[307px] max-w-full items-center lg:w-full lg:items-start"
              : "w-full items-center lg:items-stretch"
          }`}
        >
          <div
            className={`flex w-full min-w-0 flex-col gap-3 ${
              exchangeTriple ? "items-center lg:items-start" : "items-center lg:items-stretch"
            }`}
          >
            <div className="flex w-full min-w-0 justify-center lg:justify-start">
              {imageUrl ? (
                <CollectionCoverFrame
                  imageUrl={imageUrl}
                  alt=""
                  variant="hero"
                  className="relative z-[1] shrink-0"
                />
              ) : (
                <div className={`flex w-[307px] max-w-full h-[427px] max-h-[min(427px,90svh)] items-center justify-center rounded-2xl ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS} p-6 text-center text-[12px] text-gray-500`}>
                  No preview
                </div>
              )}
            </div>
            {belowCover != null ? (
              <div className="w-full min-w-0 max-w-[307px] lg:max-w-none">{belowCover}</div>
            ) : null}
            {heroActions != null ? (
              <div className="flex w-full max-w-[307px] shrink-0 flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-stretch sm:gap-x-2 sm:gap-y-2">
                {heroActions}
              </div>
            ) : null}
          </div>
          {metadataExpand ? (
            <CollectionMetadataExpandable metadataRows={metadataRows} {...metadataExpand} />
          ) : metadataRows.length > 0 && !exchangeTriple ? (
            <dl className="w-full grid grid-cols-2 gap-2 text-[13px]">
              {metadataRows.map((row) => (
                <div
                  key={row.label}
                  className={`rounded-lg ${COLLECTION_DETAILS_BORDER_ALL} bg-black/25 px-2.5 py-2 col-span-2 sm:col-span-1`}
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

        {/* Middle: chart (+ book in exchange layout). */}
        <div className="flex min-w-0 w-full max-w-full flex-col items-stretch gap-2 overflow-x-clip sm:gap-2.5 lg:self-start">
          {exchangeTriple ? (
            <>
              <div className="relative w-full min-w-0">
                {orderBookToggleEnabled ? (
                  <div className="pointer-events-none absolute right-[calc(0.75rem+1px)] top-[-1px] z-[8] sm:right-[calc(1rem+1px)]">
                    <div className="pointer-events-auto">
                      <CollectionOrderBookVisibilityToggle
                        checked={showOrderBook}
                        onChange={onShowOrderBookChange}
                        rowJustify="end"
                        contentWidth
                      />
                    </div>
                  </div>
                ) : null}
                <div className={COLLECTION_MARKET_CLUSTER_BEZEL}>
                <div className={COLLECTION_MARKET_CLUSTER_MAT}>
                  {chartMetricsRow != null ? (
                    <div
                      className={`w-full min-w-0 ${
                        orderBookToggleEnabled
                          ? "pt-[calc(1.25rem-5px)] sm:pt-[calc(1.5rem-5px)] lg:pt-[calc(1.25rem-5px)]"
                          : ""
                      }`}
                    >
                      {chartMetricsRow}
                    </div>
                  ) : null}

                  <div
                    className={[
                      chartMetricsRow != null ? "mt-3" : "",
                      "flex min-w-0 w-full flex-col gap-3 max-xl:gap-3",
                      "xl:grid xl:min-h-0 xl:gap-x-3 xl:gap-y-3",
                      orderBookColumnVisible
                        ? "xl:grid-cols-[minmax(0,1fr)_221px]"
                        : "xl:grid-cols-[minmax(0,1fr)]",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                  {/* Row 1: chart — fixed 409px to match order book */}
                  <div className="flex min-h-0 min-w-0 flex-col xl:col-start-1 xl:row-start-1 xl:h-[409px] xl:max-h-[409px]">
                    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col xl:h-full">
                      {priceChart ?? (
                        <CollectionPriceHistoryPlaceholder className="w-full min-h-[128px] max-xl:min-h-[min(152px,_20svh)] xl:h-full xl:min-h-0" />
                      )}
                    </div>
                  </div>

                  {/* Row 1 col 2: order book — fixed 409px */}
                  {orderBookColumnVisible ? (
                    <div className="flex min-h-0 w-full min-w-0 max-w-full flex-col gap-2 self-start xl:col-start-2 xl:row-start-1 xl:w-[221px] xl:shrink-0">
                      {exchangeRightStackTop ? (
                        <div className="min-h-0 w-full min-w-0 shrink-0 overflow-y-auto">
                          {exchangeRightStackTop}
                        </div>
                      ) : null}
                      <div className={`overflow-hidden ${COLLECTION_EXCHANGE_ORDER_BOOK_FRAME} max-xl:max-w-full`}>
                        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
                          {withFlushProp(orderBookNextToChart)}
                        </div>
                      </div>
                      {exchangeDockTradePanel ? withFlushProp(tradePanel) : null}
                    </div>
                  ) : null}

                  {exchangeChartFooter != null ? (
                    <div
                      className={`min-w-0 shrink-0 pt-2.5 sm:pt-3 xl:row-start-2 ${
                        orderBookColumnVisible ? "xl:col-span-2" : ""
                      }`}
                    >
                      {exchangeChartFooter}
                    </div>
                  ) : null}
                  {exchangeBelowChart != null ? (
                    <div
                      className={[
                        "min-w-0 w-full max-xl:mt-2 xl:mt-1",
                        "xl:col-start-1",
                        orderBookColumnVisible ? "xl:col-span-2" : "xl:col-span-1",
                        exchangeChartFooter != null ? "xl:row-start-3" : "xl:row-start-2",
                      ].join(" ")}
                      id="collection-listings"
                      aria-label="Individual listings"
                    >
                      {exchangeBelowChart}
                    </div>
                  ) : null}
                </div>
                </div>
              </div>
              </div>
            </>
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
              <div className={`mt-4 rounded-xl ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS} px-3 py-3 sm:px-4 sm:py-4`}>
                {tradeTicket}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
