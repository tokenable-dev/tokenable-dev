"use client";

import { useMemo, type ReactNode } from "react";
import {
  BUY_NOW_OUTLINE_GRADIENT,
  GradientOutlineFrame,
  gradientOutlineInnerButtonClass,
} from "@/components/ui/GradientOutlineFrame";
import type { AssetDetailHeadlineParts } from "@/lib/marketplace/assetDetailHeadline";
import {
  buildRwaDetailMobileTrustView,
  formatRwaMobileSlabLabelLine,
  formatRwaMobileSlabLabelTwoLines,
  type RwaDetailMetadata,
} from "@/lib/marketplace/rwa-detail";
import {
  RWA_DETAIL_BUY_NOW_FRAME_SHADOW,
  RWA_DETAIL_BUY_NOW_TEXT_CLASS,
  RWA_DETAIL_CTA_HEIGHT_CLASS,
  RWA_DETAIL_LISTING_PRICE_COMPACT_AMOUNT_CLASS,
  RWA_DETAIL_STICKY_FOOTER_PB_CLASS,
  RWA_DETAIL_MOBILE_CTA_FRAME_ROUNDED,
  RWA_DETAIL_MOBILE_CTA_INNER_ROUNDED,
  RWA_DETAIL_MOBILE_CTA_RIM_PAD_CLASS,
  RWA_DETAIL_TITLE_CERT_WEIGHT_CLASS,
  RWA_DETAIL_TITLE_WEIGHT_CLASS,
  RWA_MOBILE_SLAB_CAPTION_BLOCK_CLASS,
  RWA_MOBILE_SLAB_CAPTION_LINE_GAP_CLASS,
  rwaDetailRightFont,
} from "@/components/marketplace/rwa-detail/theme";

/** Muted blue-grey slab copy (lines 1–2 body). */
const MOBILE_SLAB_CAPTION_MUTED_COLOR = "text-[#8BA1B3]";
/** Brighter off-white for grade on line 2. */
const MOBILE_SLAB_CAPTION_GRADE_COLOR = "text-[#E4E9ED]";
const MOBILE_SLAB_CAPTION_BASE =
  "uppercase leading-[1.2] tracking-normal";
const MOBILE_SLAB_CAPTION_LINE_CLASS = `block line-clamp-1 break-normal ${MOBILE_SLAB_CAPTION_BASE}`;

function mobileSlabCaptionSizeClass(charCount: number, tier: "primary" | "secondary"): string {
  if (tier === "primary") {
    if (charCount > 48) return `text-[13px] ${RWA_DETAIL_TITLE_WEIGHT_CLASS} sm:text-[14px]`;
    if (charCount > 36) return `text-[14px] ${RWA_DETAIL_TITLE_WEIGHT_CLASS} sm:text-[15px]`;
    return `text-[15px] ${RWA_DETAIL_TITLE_WEIGHT_CLASS} sm:text-[16px]`;
  }
  if (charCount > 85) return "text-[8px] font-medium sm:text-[9px]";
  if (charCount > 72) return "text-[9px] font-medium sm:text-[10px]";
  if (charCount > 55) return "text-[10px] font-medium sm:text-[11px]";
  if (charCount > 40) return "text-[11px] font-medium sm:text-[12px]";
  return "text-[12px] font-medium sm:text-[13px]";
}

/** Full PSA slab text — three lines directly under the hero image (mobile). */
export function RwaDetailMobileSlabCaption({
  headlineParts,
  titleLoading = false,
  metadata = null,
}: {
  headlineParts: AssetDetailHeadlineParts | null;
  titleLoading?: boolean;
  metadata?: RwaDetailMetadata | null;
}) {
  const trust = useMemo(
    () => buildRwaDetailMobileTrustView(metadata),
    [metadata],
  );
  const { line1, line2, line2Grade, line3 } = useMemo(() => {
    if (!headlineParts) {
      return { line1: "—", line2: "", line2Grade: "", line3: "" };
    }
    return formatRwaMobileSlabLabelTwoLines(headlineParts, trust);
  }, [headlineParts, trust]);
  const fullLabel = useMemo(() => {
    if (!headlineParts) return "—";
    return formatRwaMobileSlabLabelLine(headlineParts, trust);
  }, [headlineParts, trust]);
  const line2DisplayLen = (line2 + line2Grade).length;
  const line1Class = `${MOBILE_SLAB_CAPTION_LINE_CLASS} ${MOBILE_SLAB_CAPTION_MUTED_COLOR} ${mobileSlabCaptionSizeClass(line1.length, "primary")}`;
  const line2Class = `${MOBILE_SLAB_CAPTION_LINE_CLASS} ${mobileSlabCaptionSizeClass(line2DisplayLen, "secondary")}`;
  const line2MutedClass = MOBILE_SLAB_CAPTION_MUTED_COLOR;
  const line2GradeClass = `${MOBILE_SLAB_CAPTION_GRADE_COLOR} ${RWA_DETAIL_TITLE_WEIGHT_CLASS}`;
  const line3Class = `${MOBILE_SLAB_CAPTION_LINE_CLASS} text-[14px] ${RWA_DETAIL_TITLE_CERT_WEIGHT_CLASS} tabular-nums text-white sm:text-[15px]`;
  const showLine2 = Boolean(line2 || line2Grade);

  return (
    <footer
      className={`${rwaDetailRightFont.className} ${RWA_MOBILE_SLAB_CAPTION_BLOCK_CLASS} min-w-0 lg:hidden`}
    >
      {titleLoading ? (
        <div
          className={`flex w-full flex-col ${RWA_MOBILE_SLAB_CAPTION_LINE_GAP_CLASS}`}
          aria-hidden
        >
          <div className="h-4 w-full animate-pulse rounded bg-zinc-800/85" />
          <div className="h-4 w-full animate-pulse rounded bg-zinc-800/80" />
          <div className="h-4 w-[45%] animate-pulse rounded bg-zinc-800/75" />
        </div>
      ) : (
        <>
          <h1 className="sr-only">{fullLabel}</h1>
          <p
            className={`flex min-w-0 flex-col ${RWA_MOBILE_SLAB_CAPTION_LINE_GAP_CLASS}`}
            title={fullLabel}
          >
            <span className={line1Class}>{line1}</span>
            {showLine2 ? (
              <span className={line2Class}>
                {line2 ? (
                  <span className={line2MutedClass}>{line2}</span>
                ) : null}
                {line2 && line2Grade ? " " : null}
                {line2Grade ? (
                  <span className={line2GradeClass}>{line2Grade}</span>
                ) : !line2 ? (
                  "\u00A0"
                ) : null}
              </span>
            ) : (
              <span className={`${line2Class} ${line2MutedClass}`}>{"\u00A0"}</span>
            )}
            {line3 ? <span className={line3Class}>{line3}</span> : null}
          </p>
        </>
      )}
    </footer>
  );
}

/**
 * Scroll only the card copy region — height stops above the fixed CTA (no document `pb` ghost scroll).
 */
export const RWA_MOBILE_CONTENT_SCROLL_CLASS =
  "scrollbar-dark max-lg:max-h-[calc(100svh-4rem-5.5rem-env(safe-area-inset-bottom,0px))] max-lg:overflow-y-auto max-lg:overflow-x-hidden max-lg:overscroll-y-contain";

export function RwaDetailStickyBuyFooter({
  children,
  footerNote,
}: {
  children: ReactNode;
  footerNote?: ReactNode;
}) {
  return (
    <div
      className={`pointer-events-none fixed bottom-0 left-0 right-0 z-[90] flex w-full flex-col items-center px-3 sm:px-4 lg:hidden ${RWA_DETAIL_STICKY_FOOTER_PB_CLASS}`}
      role="region"
      aria-label="Purchase actions"
    >
      {footerNote != null ? (
        <div className="pointer-events-auto mb-2 w-full min-w-0 max-w-[min(100%,480px)] rounded-lg bg-black/90 px-3 py-2 text-center backdrop-blur-sm">
          {footerNote}
        </div>
      ) : null}
      <div className="pointer-events-auto w-full min-w-0 max-w-[min(100%,480px)]">{children}</div>
    </div>
  );
}

/** Price line above mobile sticky CTA — kept outside the button for uniform height. */
export function RwaDetailStickyPriceLine({
  priceUsd,
  caption,
}: {
  priceUsd: number;
  caption?: string;
}) {
  const priceStr = priceUsd.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return (
    <div className={`${rwaDetailRightFont.className} mb-2.5 text-center`}>
      {caption?.trim() ? (
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
          {caption}
        </p>
      ) : null}
      <p className={RWA_DETAIL_LISTING_PRICE_COMPACT_AMOUNT_CLASS}>
        ${priceStr}
      </p>
    </div>
  );
}

/** Mobile sticky CTA — product gradient rim; uniform height across states. */
export function RwaDetailStickyBuyButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** @deprecated Buy-now rim is always used on mobile sticky CTAs. */
  emphasis?: "primary" | "default";
  /** @deprecated Render price via RwaDetailStickyPriceLine above the button. */
  priceUsd?: number | null;
  /** @deprecated Render price via RwaDetailStickyPriceLine above the button. */
  priceCaption?: string;
}) {
  return (
    <GradientOutlineFrame
      className={`group/cta w-full min-w-0 transition-shadow duration-200 ease-out ${RWA_DETAIL_BUY_NOW_FRAME_SHADOW}`}
      roundedClass={RWA_DETAIL_MOBILE_CTA_FRAME_ROUNDED}
      padClass={RWA_DETAIL_MOBILE_CTA_RIM_PAD_CLASS}
      style={{ background: BUY_NOW_OUTLINE_GRADIENT }}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`${rwaDetailRightFont.className} ${gradientOutlineInnerButtonClass} ${RWA_DETAIL_CTA_HEIGHT_CLASS} flex w-full min-w-0 items-center justify-center ${RWA_DETAIL_MOBILE_CTA_INNER_ROUNDED} border-0 px-4 text-[14px] font-bold leading-none tracking-wide outline-none transition-[background-color,box-shadow,filter] duration-200 ease-out enabled:hover:bg-zinc-950 enabled:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(16,211,51,0.1)] enabled:hover:brightness-110 enabled:hover:saturate-110 motion-reduce:transition-none motion-reduce:enabled:hover:brightness-100 sm:text-[15px] ${RWA_DETAIL_BUY_NOW_TEXT_CLASS}`}
        style={{ backgroundColor: "#000000" }}
      >
        {children}
      </button>
    </GradientOutlineFrame>
  );
}
