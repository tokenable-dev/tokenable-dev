"use client";

import type { ReactNode } from "react";
import { CollectionCoverFrame } from "@/components/marketplace/CollectionCoverFrame";
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
  stats: CollectionOverviewStat[];
  /** Depth book (left on wide screens) */
  orderBook: ReactNode;
  /** Compact buy/sell ticket (right on wide screens) */
  tradeTicket: ReactNode;
  listingCount: number;
}

function StatCard({ stat }: { stat: CollectionOverviewStat }) {
  const toneClass =
    stat.tone === "up"
      ? "text-emerald-400"
      : stat.tone === "down"
        ? "text-rose-400"
        : "text-white";
  return (
    <div className="rounded-xl border border-gray-800/90 bg-black/30 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] text-center">
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{stat.label}</p>
      <p className={`mt-1 text-sm font-semibold tabular-nums tracking-tight ${toneClass}`}>
        {stat.value}
      </p>
      {stat.sub && <p className="text-[10px] text-gray-600 mt-0.5">{stat.sub}</p>}
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
  orderBook,
  tradeTicket,
  listingCount,
}: CollectionOverviewBoardProps) {
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

      <div className="relative border-b border-gray-800/70 px-4 sm:px-6 lg:px-8 pt-6 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md border border-amber-500/25 bg-amber-500/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">
                {badgeLabel}
              </span>
              <span className="text-[11px] text-gray-600 tabular-nums">
                {listingCount} listing{listingCount === 1 ? "" : "s"}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-white text-balance leading-tight">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-sm text-gray-500 max-w-2xl leading-relaxed">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-gray-700/90 bg-white/[0.03] p-2 text-gray-500 hover:text-amber-200/90 hover:border-amber-500/30 transition-colors"
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

      <div className="relative grid gap-6 lg:gap-8 p-4 sm:p-6 lg:px-8 lg:pt-8 lg:pb-6 lg:grid-cols-[minmax(180px,240px)_minmax(0,1fr)_minmax(220px,300px)] lg:items-start">
        {/* Left: preview + meta */}
        <div className="flex flex-col items-center lg:items-stretch gap-4">
          <div className="flex justify-center lg:justify-start">
            {imageUrl ? (
              <CollectionCoverFrame
                imageUrl={imageUrl}
                alt=""
                variant="hero"
                className="relative z-[1] shrink-0"
              />
            ) : (
              <div className="flex aspect-[3/4] w-full max-w-[min(100%,260px)] items-center justify-center rounded-2xl border border-gray-800/90 bg-gradient-to-br from-gray-900/90 to-gray-950 p-6 text-center text-[12px] text-gray-500">
                No preview
              </div>
            )}
          </div>
          {metadataRows.length > 0 && (
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
          )}
        </div>

        {/* Middle: stats + chart — centered in column */}
        <div className="min-w-0 flex flex-col gap-4 items-center w-full">
          <div className="w-full max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {stats.map((s) => (
              <StatCard key={s.label} stat={s} />
            ))}
          </div>
          <div className="w-full max-w-3xl mx-auto min-w-0">
            <CollectionPriceHistoryPlaceholder className="min-h-[180px] sm:min-h-[200px] w-full" />
          </div>
        </div>

        {/* Right: order book only (trade bar spans full width below) */}
        <div className="min-w-0 w-full max-w-[300px] lg:justify-self-end flex flex-col lg:sticky lg:top-4">
          <div className="min-w-0 min-h-0">{orderBook}</div>
        </div>
      </div>

      {/* Bottom action bar — full width: Price & Amount (left), Buy & Sell (right), per reference layout */}
      <div className="border-t border-gray-800/80 bg-[#14171f] px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
        {tradeTicket}
      </div>
    </section>
  );
}
