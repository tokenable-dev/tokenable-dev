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
  HEADLINE_OUTLINE_TAG_MOBILE,
} from "../theme/constants";
import { PsaVaultOutlineTag } from "@/components/marketplace/rwa-detail-asset-panel/ui/PsaVaultBadge";

export function CollectionMobileHeadline({
  headlineTitle,
  headlineStructuredTitle,
  headlineSubtitleLine,
  headlineCardNumber,
  categoryBadge,
  gradeBadge,
  populationBadge,
  badgeLabel,
  suppressTitle,
}: {
  headlineTitle: string;
  headlineStructuredTitle?: AssetDetailHeadlineParts | null;
  headlineSubtitleLine: string | null;
  headlineCardNumber?: string | null;
  categoryBadge?: string | null;
  gradeBadge?: string | null;
  populationBadge?: string | null;
  badgeLabel: string;
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

      <div className="flex flex-wrap items-center gap-1.5 pt-0.5" aria-label="Collection tags">
        {categoryBadge ? (
          <span className={HEADLINE_OUTLINE_TAG_MOBILE}>{categoryBadge}</span>
        ) : (
          <span className={HEADLINE_OUTLINE_TAG_MOBILE}>{badgeLabel}</span>
        )}
        {gradeBadge ? (
          <span className={HEADLINE_OUTLINE_TAG_MOBILE}>{gradeBadge}</span>
        ) : null}
        <PsaVaultOutlineTag variant="mobile" />
      </div>
    </header>
  );
}
