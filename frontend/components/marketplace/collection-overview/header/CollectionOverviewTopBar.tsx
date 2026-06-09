"use client";

import { AssetDetailHeadlineTitle } from "@/components/marketplace/marketplace-shared";
import type { AssetDetailHeadlineParts } from "@/lib/marketplace/assetDetailHeadline";
import {
  COLLECTION_DETAILS_BORDER_B,
  COLLECTION_DETAILS_BORDER_T,
} from "@/components/marketplace/collectionOverviewChrome";
import {
  collectionHeroFont,
  COLLECTION_HEADLINE_TITLE_CLASS,
  HEADLINE_NAME_TEXT,
  HEADLINE_OUTLINE_TAG,
  HEADLINE_TITLE_ONE_LINE,
} from "../theme/constants";
import { PsaVaultOutlineTag } from "@/components/marketplace/rwa-detail-asset-panel/ui/PsaVaultBadge";
import type { CollectionOverviewStat } from "../types";
import { HeaderInlineStat } from "./HeaderInlineStat";

export function CollectionOverviewTopBar({
  title,
  subtitle,
  headlineTitle,
  headlineStructuredTitle,
  headlineSubtitleLine,
  useStructuredHeadline,
  headlineTitleLayout,
  categoryBadge,
  gradeBadge,
  populationBadge,
  badgeLabel,
  listingCount,
  showListingSummary,
  stats,
  showMobileHeroIdentity,
  hideTopHeadlineBarOnMobile,
  suppressHeadlineBanner,
}: {
  title: string;
  subtitle?: string | null;
  headlineTitle?: string | null;
  headlineStructuredTitle?: AssetDetailHeadlineParts | null;
  headlineSubtitleLine: string | null;
  useStructuredHeadline: boolean;
  headlineTitleLayout: boolean;
  categoryBadge?: string | null;
  gradeBadge?: string | null;
  populationBadge?: string | null;
  badgeLabel: string;
  listingCount: number;
  showListingSummary: boolean;
  stats: CollectionOverviewStat[];
  showMobileHeroIdentity: boolean;
  hideTopHeadlineBarOnMobile: boolean;
  suppressHeadlineBanner: boolean;
}) {
  return (
    <div
      className={`relative px-3.5 pt-3 pb-0 sm:px-6 sm:pt-4 sm:pb-0 lg:px-8 ${COLLECTION_DETAILS_BORDER_B} ${
        hideTopHeadlineBarOnMobile ? "max-lg:hidden" : ""
      }`}
    >
      <div className="flex flex-col gap-3 sm:gap-3 lg:flex-row lg:items-stretch lg:gap-0">
        <div className="flex min-w-0 flex-1 flex-col gap-3 lg:shrink-0 lg:basis-[min(100%,min(560px,52vw))] lg:justify-center lg:basis-[min(100%,min(620px,48vw))]">
          <div
            className={`min-w-0 space-y-2 ${showMobileHeroIdentity ? "hidden lg:block" : ""}`}
          >
            {headlineTitleLayout && headlineTitle ? (
              suppressHeadlineBanner ? (
                <>
                  <h1 className="sr-only">{headlineTitle}</h1>
                  <div className={`${collectionHeroFont.className} min-w-0`}>
                    <div
                      className="flex min-w-0 flex-wrap items-center gap-2.5 max-lg:justify-center lg:justify-start"
                      aria-label="Collection tags"
                    >
                      {categoryBadge ? (
                        <span className={HEADLINE_OUTLINE_TAG}>{categoryBadge}</span>
                      ) : (
                        <span className={HEADLINE_OUTLINE_TAG}>{badgeLabel}</span>
                      )}
                      {gradeBadge ? (
                        <span className={HEADLINE_OUTLINE_TAG}>{gradeBadge}</span>
                      ) : null}
                      <PsaVaultOutlineTag variant="desktop" />
                    </div>
                  </div>
                  <span className="sr-only">{title}</span>
                </>
              ) : (
                <>
                  <div className={`${collectionHeroFont.className} min-w-0`}>
                    <div className="flex min-w-0 flex-col gap-y-2 max-lg:items-center lg:items-start">
                      {useStructuredHeadline && headlineStructuredTitle ? (
                        <AssetDetailHeadlineTitle
                          as="h1"
                          parts={headlineStructuredTitle}
                          className={COLLECTION_HEADLINE_TITLE_CLASS}
                        />
                      ) : (
                        <h1
                          className={COLLECTION_HEADLINE_TITLE_CLASS}
                          title={headlineTitle}
                        >
                          {headlineTitle}
                        </h1>
                      )}
                      <div
                        className="flex flex-wrap items-center gap-2.5 max-lg:justify-center lg:justify-start"
                        aria-label="Collection tags"
                      >
                        {categoryBadge ? (
                          <span className={HEADLINE_OUTLINE_TAG}>{categoryBadge}</span>
                        ) : (
                          <span className={HEADLINE_OUTLINE_TAG}>{badgeLabel}</span>
                        )}
                        {gradeBadge ? (
                          <span className={HEADLINE_OUTLINE_TAG}>{gradeBadge}</span>
                        ) : null}
                        <PsaVaultOutlineTag variant="desktop" />
                      </div>
                    </div>
                    {!useStructuredHeadline && headlineSubtitleLine ? (
                      <p
                        className={`mt-1 max-w-full sm:mt-1.5 max-lg:text-center lg:text-left ${COLLECTION_HEADLINE_TITLE_CLASS}`}
                      >
                        {headlineSubtitleLine}
                      </p>
                    ) : null}
                  </div>
                  <span className="sr-only">{title}</span>
                </>
              )
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={`inline-flex items-center rounded-md border border-amber-500/25 bg-amber-500/[0.08] px-1.5 py-0.5 ${HEADLINE_NAME_TEXT} font-semibold uppercase text-amber-200/90`}
                  >
                    {badgeLabel}
                  </span>
                  {showListingSummary ? (
                    <span className={`${HEADLINE_NAME_TEXT} text-zinc-500 tabular-nums`}>
                      {listingCount} listing{listingCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </div>
                <h1 className={HEADLINE_TITLE_ONE_LINE} title={title}>
                  {title}
                </h1>
                {subtitle ? <p className={HEADLINE_TITLE_ONE_LINE}>{subtitle}</p> : null}
              </>
            )}
          </div>
        </div>

        {stats.length > 0 ? (
          <>
            <div
              className="mx-5 hidden w-px shrink-0 self-stretch bg-black lg:block lg:mx-6"
              aria-hidden
            />
            <div
              className={`min-w-0 flex-1 pt-3 lg:flex lg:min-w-0 lg:items-center lg:pt-0 ${COLLECTION_DETAILS_BORDER_T} lg:border-t-0`}
            >
              <div className="mobile-scroll-x-contain -mx-1 flex gap-4 px-1 pb-0.5 sm:gap-6 lg:mx-0 lg:flex-wrap lg:gap-x-7 lg:gap-y-2 lg:overflow-visible lg:px-0 lg:pb-0">
                {stats.map((s) => (
                  <HeaderInlineStat key={s.label} stat={s} />
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
