"use client";

import { useMemo, type ReactNode } from "react";
import { TkButton } from "@/components/ds";
import { cn } from "@/lib/ds/cn";
import type { AssetDetailHeadlineParts } from "@/lib/marketplace/assetDetailHeadline";
import {
  buildRwaDetailMobileTrustView,
  formatRwaMobileSlabLabelLine,
  formatRwaMobileSlabLabelTwoLines,
  type RwaDetailMetadata,
} from "@/lib/marketplace/rwa-detail";
import {
  RWA_DETAIL_CTA_HEIGHT_CLASS,
  RWA_DETAIL_STICKY_FOOTER_PB_CLASS,
  RWA_MOBILE_SLAB_CAPTION_BLOCK_CLASS,
  RWA_MOBILE_PAGE_CHANNEL_CLASS,
  RWA_MOBILE_SLAB_CAPTION_LINE_GAP_CLASS,
  rwaDetailRightFont,
} from "@/components/marketplace/rwa-detail/theme";

/** Slab title + grade — muted silver (design ref). */
const MOBILE_SLAB_CAPTION_MUTED_COLOR = "text-[#A0AAB4]";
const MOBILE_SLAB_CAPTION_BASE =
  "uppercase leading-[1.35] tracking-normal";
/** Wrap at word boundaries — fill line width before breaking. */
const MOBILE_SLAB_CAPTION_TEXT_CLASS = `block w-full min-w-0 break-words [overflow-wrap:break-word] ${MOBILE_SLAB_CAPTION_BASE}`;
const MOBILE_SLAB_TITLE_CLASS = `${MOBILE_SLAB_CAPTION_TEXT_CLASS} ${MOBILE_SLAB_CAPTION_MUTED_COLOR} text-[14px] font-normal sm:text-[15px]`;
const MOBILE_SLAB_META_ROW_CLASS = `${MOBILE_SLAB_CAPTION_TEXT_CLASS} flex flex-wrap items-baseline gap-x-4 text-[14px] sm:gap-x-5 sm:text-[15px]`;
const MOBILE_SLAB_GRADE_CLASS = `${MOBILE_SLAB_CAPTION_MUTED_COLOR} font-bold`;
const MOBILE_SLAB_CERT_CLASS = "font-bold tabular-nums text-white";

/** Full PSA slab text — title + grade/cert row under the hero image (mobile). */
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
  const { titleBlock, gradeLine, certLabel } = useMemo(() => {
    if (!headlineParts) {
      return { titleBlock: "—", gradeLine: "", certLabel: "" };
    }
    return formatRwaMobileSlabLabelTwoLines(headlineParts, trust);
  }, [headlineParts, trust]);
  const fullLabel = useMemo(() => {
    if (!headlineParts) return "—";
    return formatRwaMobileSlabLabelLine(headlineParts, trust);
  }, [headlineParts, trust]);
  const showMetaRow = Boolean(gradeLine || certLabel);

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
          <div className="h-4 w-[55%] animate-pulse rounded bg-zinc-800/75" />
        </div>
      ) : (
        <>
          <h1 className="sr-only">{fullLabel}</h1>
          <p
            className={`flex min-w-0 flex-col ${RWA_MOBILE_SLAB_CAPTION_LINE_GAP_CLASS}`}
            title={fullLabel}
          >
            <span className={MOBILE_SLAB_TITLE_CLASS}>{titleBlock}</span>
            {showMetaRow ? (
              <span className={MOBILE_SLAB_META_ROW_CLASS}>
                {gradeLine ? (
                  <span className={MOBILE_SLAB_GRADE_CLASS}>{gradeLine}</span>
                ) : null}
                {certLabel ? (
                  <span className={MOBILE_SLAB_CERT_CLASS}>{certLabel}</span>
                ) : null}
              </span>
            ) : null}
          </p>
        </>
      )}
    </footer>
  );
}

export function RwaDetailStickyBuyFooter({
  children,
  footerNote,
}: {
  children: ReactNode;
  footerNote?: ReactNode;
}) {
  return (
    <div
      className={`pointer-events-none fixed bottom-0 left-0 right-0 z-[90] flex w-full flex-col items-center lg:hidden ${RWA_DETAIL_STICKY_FOOTER_PB_CLASS}`}
      role="region"
      aria-label="Purchase actions"
    >
      {footerNote != null ? (
        <div
          className={`pointer-events-auto mb-2 rounded-lg rd-sticky-footer__note px-3 py-2 text-center backdrop-blur-sm ${RWA_MOBILE_PAGE_CHANNEL_CLASS}`}
        >
          {footerNote}
        </div>
      ) : null}
      <div className={`pointer-events-auto ${RWA_MOBILE_PAGE_CHANNEL_CLASS}`}>{children}</div>
    </div>
  );
}

/** Mobile sticky CTA — DS primary button. */
export function RwaDetailStickyBuyButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <TkButton
      type="button"
      variant="primary"
      disabled={disabled}
      onClick={onClick}
      className={cn("w-full justify-center", RWA_DETAIL_CTA_HEIGHT_CLASS, rwaDetailRightFont.className)}
    >
      {children}
    </TkButton>
  );
}
