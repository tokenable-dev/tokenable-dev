"use client";

import Image from "next/image";
import { ASSETS } from "@/constants/assets";
import type { TapeSourceDisplay } from "@/lib/marketplace/unified-order-book/tapeSideDisplay";
import type { TapeSourceBrandId } from "@/lib/marketplace/unified-order-book/tapeSourceBrand";
import { openExternalSaleListing } from "@/lib/marketplace/unified-order-book";

const LOGO_BY_BRAND: Record<TapeSourceBrandId, string> = ASSETS.icons.marketplaceLogos;

/** Trades Source — text wordmarks only (no favicon / emblem marks). */
const TEXT_ONLY_BRANDS = new Set<TapeSourceBrandId>(["tokenable"]);

/** eBay wordmark footprint (48×16px) — every Source mark fits this exact slot. */
const LOGO_BOX_CLASS = "inline-flex h-4 w-12 shrink-0 items-center justify-center";

const LOGO_BOX_CLASS_COMPACT = "inline-flex h-3.5 w-[2.625rem] shrink-0 items-center justify-center";

const LOGO_IMG_CLASS =
  "max-h-full max-w-full object-contain object-center opacity-90 transition-opacity";

const LOGO_IMG_CLASS_COMPACT =
  "max-h-full max-w-full object-contain object-center opacity-90 transition-opacity";

const LOGO_IMG_CLASS_LINKED = `${LOGO_IMG_CLASS} group-hover:opacity-100`;

const LOGO_IMG_CLASS_LINKED_COMPACT = `${LOGO_IMG_CLASS_COMPACT} group-hover:opacity-100`;

/** ~3:1 wordmark aspect (matches ebay.svg viewBox). */
const LOGO_INTRINSIC_WIDTH = 48;
const LOGO_INTRINSIC_HEIGHT = 16;

type TapeSource = TapeSourceDisplay;

const WORDMARK_TEXT_CLASS =
  "block max-w-full truncate text-center text-[12px] font-medium leading-4 tracking-tight text-zinc-300";

const WORDMARK_TEXT_CLASS_COMPACT =
  "block max-w-full truncate text-center text-[11px] font-medium leading-[0.875rem] tracking-tight text-zinc-300";

function TradeSourceWordmark({
  label,
  linked,
  compact = false,
}: {
  label: string;
  linked?: boolean;
  compact?: boolean;
}) {
  const base = compact ? WORDMARK_TEXT_CLASS_COMPACT : WORDMARK_TEXT_CLASS;
  const boxCls = compact ? LOGO_BOX_CLASS_COMPACT : LOGO_BOX_CLASS;
  return (
    <span className={boxCls}>
      <span className={`${base}${linked ? " text-mint/85 group-hover:text-mint" : ""}`}>
        {label}
      </span>
    </span>
  );
}

function TradeSourceLogo({
  brandId,
  label,
  linked,
  compact = false,
}: {
  brandId: TapeSourceBrandId;
  label: string;
  linked?: boolean;
  compact?: boolean;
}) {
  const src = LOGO_BY_BRAND[brandId];
  const boxCls = compact ? LOGO_BOX_CLASS_COMPACT : LOGO_BOX_CLASS;
  const imgCls = linked
    ? compact
      ? LOGO_IMG_CLASS_LINKED_COMPACT
      : LOGO_IMG_CLASS_LINKED
    : compact
      ? LOGO_IMG_CLASS_COMPACT
      : LOGO_IMG_CLASS;

  return (
    <span className={boxCls}>
      <Image
        src={src}
        alt={label}
        width={LOGO_INTRINSIC_WIDTH}
        height={LOGO_INTRINSIC_HEIGHT}
        className={imgCls}
        unoptimized
      />
    </span>
  );
}

export function TradeSourceMark({
  source,
  className,
  compact = false,
}: {
  source: TapeSource;
  className?: string;
  compact?: boolean;
}) {
  const sharedCls = `inline-flex min-w-0 max-w-full items-center justify-center${
    className ? ` ${className}` : ""
  }`;

  if (source.brandId) {
    const linked = Boolean(source.href);
    const isTextOnly = TEXT_ONLY_BRANDS.has(source.brandId);
    const content = isTextOnly ? (
      <TradeSourceWordmark label={source.label} linked={linked} compact={compact} />
    ) : (
      <TradeSourceLogo
        brandId={source.brandId}
        label={source.label}
        linked={linked}
        compact={compact}
      />
    );

    if (linked) {
      return (
        <button
          type="button"
          className={`${sharedCls} group cursor-pointer rounded-sm bg-transparent p-0 ring-offset-2 ring-offset-zinc-950 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/40`}
          title={source.title}
          aria-label={source.title ?? `Open sold listing on ${source.label}`}
          onClick={() => openExternalSaleListing(source.href!)}
        >
          {content}
        </button>
      );
    }

    return (
      <span className={sharedCls} title={source.title}>
        {content}
      </span>
    );
  }

  if (source.href) {
    return (
      <button
        type="button"
        className={`${sharedCls} ${source.className} cursor-pointer truncate bg-transparent p-0 ${
          compact ? "text-[11px]" : "text-[12px]"
        } font-normal leading-[1.3] tracking-tight`}
        title={source.title}
        onClick={() => openExternalSaleListing(source.href!)}
      >
        {source.label}
      </button>
    );
  }

  return (
    <span
      className={`${sharedCls} truncate ${
        compact ? "text-[11px]" : "text-[12px]"
      } font-normal leading-[1.3] tracking-tight ${source.className}`}
      title={source.title}
    >
      {source.label}
    </span>
  );
}
