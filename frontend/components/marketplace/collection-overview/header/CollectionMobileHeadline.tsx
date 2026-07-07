"use client";

import { AssetDetailHeadlineTitle } from "@/components/marketplace/marketplace-shared";
import {
  assetDetailHeadlineHasContent,
  formatAssetDetailHeadlineText,
  type AssetDetailHeadlineParts,
} from "@/lib/marketplace/assetDetailHeadline";
import {
  COLLECTION_DETAIL_ARIAL_FONT_CLASS,
  COLLECTION_DETAIL_MOBILE_ARIAL_STYLE,
  COLLECTION_HEADLINE_TITLE_MOBILE_CLASS,
} from "../theme/constants";

export function CollectionMobileHeadline({
  headlineTitle,
  headlineStructuredTitle,
  headlineSubtitleLine,
  headlineCardNumber,
  suppressTitle,
}: {
  headlineTitle: string;
  headlineStructuredTitle?: AssetDetailHeadlineParts | null;
  headlineSubtitleLine: string | null;
  headlineCardNumber?: string | null;
  suppressTitle?: boolean;
}) {
  const cardNo = headlineCardNumber?.trim() || null;
  const structuredHasCardNo = Boolean(
    headlineStructuredTitle &&
      assetDetailHeadlineHasContent(headlineStructuredTitle) &&
      /#\s*\S+/.test(formatAssetDetailHeadlineText(headlineStructuredTitle)),
  );

  return (
    <header
      className={`${COLLECTION_DETAIL_ARIAL_FONT_CLASS} w-full min-w-0 space-y-1 text-left lg:hidden`}
      style={COLLECTION_DETAIL_MOBILE_ARIAL_STYLE}
    >
      {suppressTitle ? (
        <h1 className="sr-only">{headlineTitle}</h1>
      ) : headlineStructuredTitle &&
        assetDetailHeadlineHasContent(headlineStructuredTitle) ? (
        <AssetDetailHeadlineTitle
          as="h1"
          parts={headlineStructuredTitle}
          className={`line-clamp-2 ${COLLECTION_HEADLINE_TITLE_MOBILE_CLASS}`}
          style={COLLECTION_DETAIL_MOBILE_ARIAL_STYLE}
        />
      ) : (
        <h1
          className={`line-clamp-2 ${COLLECTION_HEADLINE_TITLE_MOBILE_CLASS}`}
          style={COLLECTION_DETAIL_MOBILE_ARIAL_STYLE}
          title={headlineTitle}
        >
          {headlineTitle}
        </h1>
      )}

      {!headlineStructuredTitle && headlineSubtitleLine ? (
        <p
          className={`line-clamp-2 ${COLLECTION_HEADLINE_TITLE_MOBILE_CLASS}`}
          style={COLLECTION_DETAIL_MOBILE_ARIAL_STYLE}
        >
          {headlineSubtitleLine}
        </p>
      ) : null}

      {cardNo && !structuredHasCardNo ? (
        <p
          className={`${COLLECTION_DETAIL_ARIAL_FONT_CLASS} text-[11px] font-normal tabular-nums text-zinc-500`}
          style={COLLECTION_DETAIL_MOBILE_ARIAL_STYLE}
        >
          {cardNo}
        </p>
      ) : null}
    </header>
  );
}
