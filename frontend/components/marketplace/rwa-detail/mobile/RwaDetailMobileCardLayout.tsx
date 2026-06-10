"use client";

import { useMemo, type ReactNode } from "react";
import {
  GradientOutlineFrame,
  gradientOutlineInnerButtonClass,
} from "@/components/ui/GradientOutlineFrame";
import type { AssetDetailHeadlineParts } from "@/lib/marketplace/assetDetailHeadline";
import { formatUsdcPricePrimary } from "@/lib/market/usdcKrwDisplay";
import {
  buildRwaDetailMobileTrustView,
  formatRwaMobileSlabLabelLine,
  formatRwaMobileSlabLabelTwoLines,
  type RwaDetailMetadata,
} from "@/lib/marketplace/rwa-detail";
import {
  RWA_DETAIL_BUTTON_FRAME_ROUNDED,
  RWA_DETAIL_BUTTON_INNER_ROUNDED,
  RWA_DETAIL_BUTTON_RIM_PAD_CLASS,
} from "@/components/marketplace/rwa-detail/theme";

const MOBILE_SLAB_CAPTION_LINE_CLASS =
  "text-[11px] font-medium uppercase leading-snug tracking-wide text-zinc-400 [overflow-wrap:anywhere] sm:text-[12px] sm:leading-[1.35]";

/** Full PSA slab text — two lines directly under the hero image (mobile). */
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
  const { line1, line2 } = useMemo(() => {
    if (!headlineParts) return { line1: "—", line2: "" };
    return formatRwaMobileSlabLabelTwoLines(headlineParts, trust);
  }, [headlineParts, trust]);
  const fullLabel = useMemo(() => {
    if (!headlineParts) return "—";
    return formatRwaMobileSlabLabelLine(headlineParts, trust);
  }, [headlineParts, trust]);

  return (
    <footer className="mx-auto w-full max-w-[32rem] min-w-0 shrink-0 px-5 pb-1 pt-3 text-center lg:hidden">
      {titleLoading ? (
        <div className="mx-auto flex w-[min(100%,17rem)] max-w-full flex-col gap-1.5" aria-hidden>
          <div className="h-3.5 w-full animate-pulse rounded bg-zinc-800/85" />
          <div className="h-3.5 w-[72%] animate-pulse rounded bg-zinc-800/80" />
        </div>
      ) : (
        <>
          <h1 className="sr-only">{fullLabel}</h1>
          <p className={MOBILE_SLAB_CAPTION_LINE_CLASS}>{line1}</p>
          {line2 ? (
            <p className={`mt-0.5 ${MOBILE_SLAB_CAPTION_LINE_CLASS}`}>{line2}</p>
          ) : null}
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
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-[90] flex w-full flex-col items-center px-4 pb-[max(0.875rem,env(safe-area-inset-bottom,0px))] lg:hidden"
      role="region"
      aria-label="Purchase actions"
    >
      {footerNote != null ? (
        <div className="pointer-events-auto mb-2 w-full max-w-[32rem] min-w-0 rounded-lg bg-black/90 px-3 py-2 text-center backdrop-blur-sm">
          {footerNote}
        </div>
      ) : null}
      <div className="pointer-events-auto w-full max-w-[32rem] min-w-0">{children}</div>
    </div>
  );
}

/** Mobile sticky CTA — product gradient rim; optional fused price + action label. */
export function RwaDetailStickyBuyButton({
  children,
  onClick,
  disabled,
  emphasis = "default",
  priceUsd,
  priceCaption,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** Stronger visual weight for Buy / Connect on purchasable listings. */
  emphasis?: "primary" | "default";
  /** When set, USDC price renders inside the button above the action label. */
  priceUsd?: number | null;
  priceCaption?: string;
}) {
  const isPrimary = emphasis === "primary";
  const hasPrice =
    priceUsd != null && Number.isFinite(priceUsd) && priceUsd > 0;
  const showCaption = Boolean(priceCaption?.trim());

  const frameShadow = isPrimary
    ? "shadow-[0_0_32px_-2px_rgba(16,211,51,0.55),0_0_48px_-12px_rgba(16,211,51,0.28)] has-[:enabled]:hover:shadow-[0_0_40px_-2px_rgba(16,211,51,0.72),0_0_56px_-10px_rgba(16,211,51,0.42)]"
    : "shadow-[0_0_18px_-8px_rgba(16,211,51,0.35)] has-[:enabled]:hover:shadow-[0_0_28px_-6px_rgba(16,211,51,0.48)]";

  const actionClass = isPrimary
    ? "text-[17px] font-semibold text-mint"
    : "text-[17px] font-semibold text-white";

  return (
    <GradientOutlineFrame
      className={`group/cta w-full min-w-0 transition-shadow duration-200 ease-out ${frameShadow}`}
      roundedClass={RWA_DETAIL_BUTTON_FRAME_ROUNDED}
      padClass={RWA_DETAIL_BUTTON_RIM_PAD_CLASS}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`${gradientOutlineInnerButtonClass} flex w-full min-w-0 flex-col items-center justify-center ${RWA_DETAIL_BUTTON_INNER_ROUNDED} border-0 leading-none tracking-wide outline-none transition-[background-color,box-shadow,filter] duration-200 ease-out enabled:hover:bg-zinc-950 enabled:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(16,211,51,0.1)] enabled:hover:brightness-110 motion-reduce:transition-none motion-reduce:enabled:hover:brightness-100 ${
          hasPrice
            ? "min-h-[4.75rem] gap-1.5 px-3.5 py-2.5 text-center enabled:hover:saturate-110"
            : `h-[52px] px-4 !text-[17px] !font-semibold !text-white enabled:hover:!text-white enabled:hover:brightness-105 ${
                isPrimary ? "h-[56px] !text-[18px] enabled:hover:saturate-125" : ""
              }`
        }`}
        style={{ backgroundColor: "#000000" }}
      >
        {hasPrice ? (
          <>
            {showCaption ? (
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
                {priceCaption}
              </span>
            ) : null}
            <span className="text-[1.2rem] font-bold leading-none tabular-nums text-white">
              {formatUsdcPricePrimary(priceUsd)}
            </span>
            <span className={`w-full text-center tabular-nums ${actionClass}`}>
              {children}
            </span>
          </>
        ) : (
          <span className="flex w-full items-center justify-center">{children}</span>
        )}
      </button>
    </GradientOutlineFrame>
  );
}
