"use client";

import type { ReactNode } from "react";
import { CollectionCoverFrame } from "@/components/marketplace/collection-cover";
import { CollectionMetadataExpandable } from "@/components/marketplace/collection-cover";
import {
  COLLECTION_DETAILS_BG_CLASS,
  COLLECTION_DETAILS_BORDER_ALL,
  COLLECTION_HERO_DESKTOP_HEIGHT_CLASS,
} from "@/components/marketplace/collectionOverviewChrome";
import type { CollectionOverviewBoardProps } from "../types";

export function CollectionOverviewLeftColumn({
  imageUrl,
  marketsTriple,
  useMobileTabbedMarket,
  mobileHeadlineBlock,
  mobileCurrentPriceRow,
  mobileMarketTabs,
  mobileCoverBelowMetrics,
  belowCover,
  heroActions,
  metadataExpand,
  metadataRows,
  leftColumnFooter,
}: {
  imageUrl: string | null;
  marketsTriple: boolean;
  useMobileTabbedMarket: boolean;
  mobileHeadlineBlock: ReactNode;
  mobileCurrentPriceRow?: ReactNode;
  mobileMarketTabs?: ReactNode;
  mobileCoverBelowMetrics?: ReactNode;
  belowCover?: ReactNode;
  heroActions?: ReactNode;
  metadataExpand?: CollectionOverviewBoardProps["metadataExpand"];
  metadataRows: { label: string; value: string }[];
  leftColumnFooter?: ReactNode;
}) {
  return (
    <div
      className={`flex min-w-0 w-full max-w-full flex-col gap-3 sm:gap-4 ${
        useMobileTabbedMarket
          ? "max-lg:gap-0 max-lg:overflow-visible"
          : "max-lg:min-h-0 max-lg:flex-1 max-lg:gap-1 max-lg:overflow-hidden"
      } ${marketsTriple ? "lg:w-full lg:items-start lg:min-h-0 lg:flex-1 lg:gap-0" : "w-full lg:items-stretch lg:min-h-0 lg:flex-1"}`}
    >
      <div
        className={`flex w-full min-w-0 flex-col gap-3 ${
          useMobileTabbedMarket
            ? "max-lg:gap-0 max-lg:overflow-visible"
            : "max-lg:min-h-0 max-lg:flex-1 max-lg:gap-1 max-lg:overflow-hidden"
        } ${marketsTriple ? "max-lg:items-stretch lg:items-start lg:min-h-0 lg:flex-1" : "items-stretch lg:min-h-0 lg:flex-1"}`}
      >
        <div
          className={`mx-auto flex w-full min-w-0 max-w-[min(100%,360px)] flex-col gap-2 max-lg:mx-0 max-lg:max-w-none lg:mx-0 lg:max-w-[307px] ${
            useMobileTabbedMarket
              ? "max-lg:gap-0 max-lg:overflow-visible"
              : "max-lg:w-full max-lg:gap-1 max-lg:min-h-0 max-lg:flex-1 max-lg:overflow-hidden"
          }`}
        >
          {useMobileTabbedMarket &&
          (imageUrl || mobileHeadlineBlock || mobileCurrentPriceRow) ? (
            <>
              <div className="max-lg:shrink-0 max-lg:border-b max-lg:border-zinc-800/35 max-lg:px-3.5 max-lg:pb-4 max-lg:pt-2 lg:hidden">
                <div className="flex w-full min-w-0 items-stretch gap-2.5">
                  <div className="flex min-h-[118px] min-w-0 flex-1 flex-col justify-between gap-1.5">
                    {mobileHeadlineBlock ? (
                      <div className="min-w-0">{mobileHeadlineBlock}</div>
                    ) : (
                      <div className="min-h-0 flex-1" aria-hidden />
                    )}
                    {mobileCurrentPriceRow ? (
                      <div className="mt-auto min-w-0">{mobileCurrentPriceRow}</div>
                    ) : null}
                  </div>
                  {imageUrl ? (
                    <CollectionCoverFrame
                      imageUrl={imageUrl}
                      alt=""
                      variant="hero"
                      className="relative z-[1] shrink-0 self-start max-lg:overflow-visible"
                    />
                  ) : (
                    <div
                      className={`flex h-[118px] w-[88px] shrink-0 items-center justify-center self-start rounded-xl ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS} text-center text-[9px] text-gray-500`}
                    >
                      No preview
                    </div>
                  )}
                </div>
              </div>
              <div className="hidden w-full min-w-0 lg:block">
                {imageUrl ? (
                  <CollectionCoverFrame
                    imageUrl={imageUrl}
                    alt=""
                    variant="hero"
                    className="relative z-[1] w-full overflow-visible lg:w-full"
                  />
                ) : (
                  <div
                    className={`flex w-full items-center justify-center rounded-2xl ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS} p-6 text-center text-[12px] text-gray-500 lg:w-[307px] ${COLLECTION_HERO_DESKTOP_HEIGHT_CLASS}`}
                  >
                    No preview
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex w-full min-w-0 flex-col gap-2 max-lg:flex-row max-lg:items-start max-lg:gap-2.5">
              {mobileHeadlineBlock ? (
                <div className="min-w-0 flex-1 max-lg:pt-0.5">{mobileHeadlineBlock}</div>
              ) : null}
              {imageUrl ? (
                <CollectionCoverFrame
                  imageUrl={imageUrl}
                  alt=""
                  variant="hero"
                  className="relative z-[1] w-full shrink-0 overflow-visible max-lg:ms-auto max-lg:shrink-0 lg:w-full"
                />
              ) : (
                <div
                  className={`flex h-[min(460px,82vw)] max-h-[min(480px,88svh)] w-full items-center justify-center rounded-2xl ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS} p-6 text-center text-[12px] text-gray-500 max-lg:ms-auto max-lg:h-[118px] max-lg:max-h-[122px] max-lg:w-[88px] max-lg:max-w-[88px] max-lg:shrink-0 max-lg:p-2 max-lg:text-[9px] lg:w-[307px] ${COLLECTION_HERO_DESKTOP_HEIGHT_CLASS}`}
                >
                  No preview
                </div>
              )}
            </div>
          )}
          {useMobileTabbedMarket ? (
            <div
              className="max-lg:shrink-0 max-lg:px-3 max-lg:pb-0 max-lg:pt-3.5"
              id="collection-listings"
            >
              {mobileMarketTabs}
            </div>
          ) : mobileCoverBelowMetrics != null ? (
            <div className="w-full min-w-0 max-lg:block lg:hidden">
              {mobileCoverBelowMetrics}
            </div>
          ) : null}
        </div>
        {belowCover != null ? (
          <div className="hidden w-full min-w-0 lg:mt-1 lg:block">{belowCover}</div>
        ) : null}
        {heroActions != null ? (
          <div className="flex w-full max-w-[307px] shrink-0 flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-stretch sm:gap-x-2 sm:gap-y-2">
            {heroActions}
          </div>
        ) : null}
      </div>
      {metadataExpand ? (
        <CollectionMetadataExpandable metadataRows={metadataRows} {...metadataExpand} />
      ) : metadataRows.length > 0 && !marketsTriple ? (
        <dl className="grid w-full grid-cols-2 gap-2 text-[13px]">
          {metadataRows.map((row) => (
            <div
              key={row.label}
              className={`col-span-2 rounded-lg ${COLLECTION_DETAILS_BORDER_ALL} bg-black px-2.5 py-2 sm:col-span-1`}
            >
              <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                {row.label}
              </dt>
              <dd className="mt-0.5 break-words leading-snug text-gray-100">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {leftColumnFooter}
    </div>
  );
}
