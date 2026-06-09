"use client";

import { AssetDetailHeadlineTitle } from "@/components/marketplace/marketplace-shared";
import {
  assetDetailHeadlineHasContent,
  formatAssetDetailHeadlineText,
  type AssetDetailHeadlineParts,
} from "@/lib/marketplace/assetDetailHeadline";
import {
  collectionHeroFont,
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
      className={`${collectionHeroFont.className} w-full min-w-0 space-y-1 text-left lg:hidden`}
    >
      {suppressTitle ? (
        <h1 className="sr-only">{headlineTitle}</h1>
      ) : headlineStructuredTitle &&
        assetDetailHeadlineHasContent(headlineStructuredTitle) ? (
        <AssetDetailHeadlineTitle
          as="h1"
          parts={headlineStructuredTitle}
          className={`line-clamp-3 ${COLLECTION_HEADLINE_TITLE_MOBILE_CLASS}`}
        />
      ) : (
        <h1
          className={`line-clamp-2 ${COLLECTION_HEADLINE_TITLE_MOBILE_CLASS}`}
          title={headlineTitle}
        >
          {headlineTitle}
        </h1>
      )}

      {!headlineStructuredTitle && headlineSubtitleLine ? (
        <p className={`line-clamp-2 ${COLLECTION_HEADLINE_TITLE_MOBILE_CLASS}`}>
          {headlineSubtitleLine}
        </p>
      ) : null}

      {cardNo && !structuredHasCardNo ? (
        <p className="text-[11px] font-medium tabular-nums text-zinc-500">{cardNo}</p>
      ) : null}
    </header>
  );
}
