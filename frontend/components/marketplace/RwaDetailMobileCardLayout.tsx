"use client";

import type { ReactNode } from "react";
import {
  GradientOutlineFrame,
  PRODUCT_OUTLINE_GRADIENT,
  PRODUCT_OUTLINE_PAD_CLASS,
  gradientOutlineInnerButtonClass,
} from "@/components/ui/GradientOutlineFrame";
import {
  formatApproxKrwFromUsd,
  formatUsdcPricePrimary,
} from "@/lib/market/usdcKrwDisplay";

/** @deprecated Use {@link PRODUCT_OUTLINE_GRADIENT} */
export const RWA_STICKY_BUY_BORDER_GRADIENT = PRODUCT_OUTLINE_GRADIENT;

/** Two-line mobile price — USDC primary + approximate KRW (reference: marketplace listing). */
export function RwaDetailMobilePriceStack({
  usd,
  unavailableLabel = "Not listed",
  className = "",
}: {
  usd: number | null | undefined;
  unavailableLabel?: string;
  className?: string;
}) {
  if (usd == null || !Number.isFinite(usd) || usd <= 0) {
    return (
      <span className={`text-xl font-semibold text-zinc-500 ${className}`.trim()}>
        {unavailableLabel}
      </span>
    );
  }

  return (
    <div className={`flex flex-col items-start gap-1 ${className}`.trim()}>
      <span className="text-[1.625rem] font-bold leading-none tracking-tight tabular-nums text-white">
        {formatUsdcPricePrimary(usd)}
      </span>
      <span className="text-[13px] font-normal leading-snug tabular-nums text-zinc-500">
        {formatApproxKrwFromUsd(usd)}
      </span>
    </div>
  );
}

export function RwaDetailMobileCardHeader({
  title,
  titleLoading = false,
  setDescription,
  cardIdLine,
}: {
  title: ReactNode;
  titleLoading?: boolean;
  setDescription?: string | null;
  cardIdLine?: string | null;
}) {
  return (
    <header className="mx-auto w-full max-w-[32rem] min-w-0 px-5 pb-2 pt-7 text-center lg:hidden">
      {titleLoading ? (
        <div
          className="mx-auto h-9 w-[min(100%,17rem)] max-w-full animate-pulse rounded-lg bg-zinc-800/85"
          aria-hidden
        />
      ) : (
        <h1 className="text-[1.4rem] font-bold leading-[1.2] tracking-tight text-white [overflow-wrap:anywhere] sm:text-[1.45rem]">
          <span>{title}</span>
          {cardIdLine ? (
            <span className="whitespace-nowrap font-semibold text-zinc-400/95">
              {" "}
              {cardIdLine}
            </span>
          ) : null}
        </h1>
      )}

      {setDescription ? (
        <p className="mx-auto mt-3 max-w-[26rem] text-[13px] font-normal leading-relaxed text-zinc-500/95">
          {setDescription}
        </p>
      ) : null}
    </header>
  );
}

/**
 * Scroll only the card copy region — height stops above the fixed CTA (no document `pb` ghost scroll).
 */
export const RWA_MOBILE_CONTENT_SCROLL_CLASS =
  "max-lg:max-h-[calc(100svh-4rem-9.25rem-env(safe-area-inset-bottom,0px))] max-lg:overflow-y-auto max-lg:overflow-x-hidden max-lg:overscroll-y-contain max-lg:pt-1";

export function RwaDetailStickyBuyFooter({
  children,
  footerNote,
}: {
  children: ReactNode;
  footerNote?: ReactNode;
}) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[90] w-full bg-[#07090c]/98 px-4 pt-4 pb-[max(0.875rem,env(safe-area-inset-bottom,0px))] shadow-[0_-20px_56px_-12px_rgba(0,0,0,0.92)] backdrop-blur-md max-xl:bg-black/98 lg:hidden"
      role="region"
      aria-label="Purchase actions"
    >
      {footerNote != null ? (
        <div className="mb-2 min-w-0 text-center">{footerNote}</div>
      ) : null}
      {children}
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
  /** When set, price + KRW approx render inside the button above the action label. */
  priceUsd?: number | null;
  priceCaption?: string;
}) {
  const isPrimary = emphasis === "primary";
  const hasPrice =
    priceUsd != null && Number.isFinite(priceUsd) && priceUsd > 0;
  const showCaption = Boolean(priceCaption?.trim());

  const frameShadow = isPrimary
    ? "shadow-[0_0_32px_-2px_rgba(16,211,51,0.55),0_0_48px_-12px_rgba(16,211,51,0.28)] has-[:enabled]:hover:shadow-[0_0_40px_-2px_rgba(16,211,51,0.72),0_0_56px_-10px_rgba(16,211,51,0.42)] has-[:enabled]:focus-within:shadow-[0_0_40px_-2px_rgba(16,211,51,0.72),0_0_56px_-10px_rgba(16,211,51,0.42)]"
    : "shadow-[0_0_18px_-8px_rgba(16,211,51,0.35)] has-[:enabled]:hover:shadow-[0_0_28px_-6px_rgba(16,211,51,0.48)] has-[:enabled]:focus-within:shadow-[0_0_28px_-6px_rgba(16,211,51,0.48)]";

  const actionClass = isPrimary
    ? "text-[17px] font-semibold text-mint"
    : "text-[17px] font-semibold text-white";

  return (
    <GradientOutlineFrame
      className={`group/cta w-full min-w-0 transition-shadow duration-200 ease-out ${frameShadow}`}
      roundedClass="rounded-xl"
      padClass={PRODUCT_OUTLINE_PAD_CLASS}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`${gradientOutlineInnerButtonClass} flex w-full min-w-0 flex-col items-center justify-center rounded-[7px] border-0 leading-none tracking-wide outline-none transition-[background-color,box-shadow,filter] duration-200 ease-out enabled:hover:bg-zinc-950 enabled:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(16,211,51,0.1)] enabled:hover:brightness-110 enabled:focus-visible:ring-2 enabled:focus-visible:ring-mint/50 enabled:focus-visible:ring-offset-2 enabled:focus-visible:ring-offset-black motion-reduce:transition-none motion-reduce:enabled:hover:brightness-100 ${
          hasPrice
            ? "min-h-[5.25rem] gap-2 px-3.5 py-2.5 text-center enabled:hover:saturate-110"
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
            <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
              <span className="text-[1.2rem] font-bold leading-none tabular-nums text-white">
                {formatUsdcPricePrimary(priceUsd)}
              </span>
              <span className="text-[13px] font-normal leading-none tabular-nums text-zinc-500">
                {formatApproxKrwFromUsd(priceUsd)}
              </span>
            </div>
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
