"use client";

import type { TapeSourceDisplay } from "@/lib/marketplace/unified-order-book/tapeSideDisplay";
import { openExternalSaleListing } from "@/lib/marketplace/unified-order-book";

const SOURCE_TEXT_CLASS =
  "min-w-0 max-w-full truncate text-center text-[12px] font-normal leading-snug tracking-tight text-zinc-400";

const SOURCE_TEXT_CLASS_COMPACT =
  "min-w-0 max-w-full truncate text-center text-[11px] font-normal leading-snug tracking-tight text-zinc-400";

/** Full-width grid cell — Source label centered under the column header. */
export function TradesSourceCell({
  source,
  compact = false,
  collectionDetail = false,
  className,
}: {
  source: TapeSourceDisplay;
  compact?: boolean;
  collectionDetail?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex w-full min-w-0 items-center justify-center${
        className ? ` ${className}` : ""
      }`}
    >
      <TradeSourceMark source={source} compact={compact} collectionDetail={collectionDetail} />
    </div>
  );
}

export function TradeSourceMark({
  source,
  className,
  compact = false,
  collectionDetail = false,
}: {
  source: TapeSourceDisplay;
  className?: string;
  compact?: boolean;
  collectionDetail?: boolean;
}) {
  const textCls = collectionDetail
    ? "cd-ob-trades-source__label"
    : compact
      ? SOURCE_TEXT_CLASS_COMPACT
      : SOURCE_TEXT_CLASS;
  const sharedCls = `inline-flex min-w-0 max-w-full items-center justify-center${
    className ? ` ${className}` : ""
  }`;

  if (source.href) {
    return (
      <button
        type="button"
        className={`${sharedCls} cursor-pointer bg-transparent p-0 ${textCls} hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/40 ring-offset-2 ring-offset-zinc-950`}
        title={source.title}
        aria-label={source.title ?? `Open sold listing on ${source.label}`}
        onClick={() => openExternalSaleListing(source.href!)}
      >
        {source.label}
      </button>
    );
  }

  return (
    <span className={`${sharedCls} ${textCls}`} title={source.title}>
      {source.label}
    </span>
  );
}
