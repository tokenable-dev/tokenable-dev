"use client";

import type { ReactNode } from "react";
import { CollectionCoverFrame } from "@/components/marketplace/collection-cover";
import { CollectionMetadataExpandable } from "@/components/marketplace/collection-cover";
import {
  COLLECTION_DETAILS_BG_CLASS,
  COLLECTION_DETAILS_BORDER_ALL,
  COLLECTION_HERO_DESKTOP_HEIGHT_CLASS,
} from "@/components/marketplace/collectionOverviewChrome";
import type { CollectionCoverGalleryProps } from "@/components/marketplace/collection-cover/CollectionCoverFrame";
import type { CollectionOverviewBoardProps } from "../types";

export function CollectionOverviewLeftColumn({
  imageUrl,
  marketsTriple,
  useMobileTabbedMarket,
  mobileMarketTabs,
  mobileCoverBelowMetrics,
  belowCover,
  heroActions,
  coverOverlay,
  coverGallery,
  metadataExpand,
  metadataRows,
  leftColumnFooter,
}: {
  imageUrl: string | null;
  marketsTriple: boolean;
  useMobileTabbedMarket: boolean;
  mobileMarketTabs?: ReactNode;
  mobileCoverBelowMetrics?: ReactNode;
  belowCover?: ReactNode;
  heroActions?: ReactNode;
  coverOverlay?: ReactNode;
  coverGallery?: CollectionCoverGalleryProps;
  metadataExpand?: CollectionOverviewBoardProps["metadataExpand"];
  metadataRows: { label: string; value: string }[];
  leftColumnFooter?: ReactNode;
}) {
  if (useMobileTabbedMarket) {
    return (
      <div className="w-full min-w-0 lg:hidden" id="collection-listings">
        {mobileMarketTabs}
      </div>
    );
  }

  const coverOverlaySlot =
    coverOverlay != null ? (
      <div className="pointer-events-none absolute right-1.5 top-1.5 z-20 sm:right-2 sm:top-2">
        <div className="pointer-events-auto">{coverOverlay}</div>
      </div>
    ) : null;

  const wrapCover = (cover: ReactNode) =>
    coverOverlay != null ? (
      <div className="relative w-fit max-w-full shrink-0">{coverOverlaySlot}{cover}</div>
    ) : (
      cover
    );

  return (
    <div
      className={`flex min-w-0 w-full max-w-full flex-col gap-3 sm:gap-4 max-lg:min-h-0 max-lg:flex-1 max-lg:gap-1 max-lg:overflow-hidden ${
        marketsTriple ? "lg:w-full lg:items-start lg:min-h-0 lg:flex-1 lg:gap-0" : "w-full lg:items-stretch lg:min-h-0 lg:flex-1"
      }`}
    >
      <div
        className={`flex w-full min-w-0 flex-col gap-3 max-lg:min-h-0 max-lg:flex-1 max-lg:gap-1 max-lg:overflow-hidden ${
          marketsTriple ? "max-lg:items-stretch lg:items-start lg:min-h-0 lg:flex-1" : "items-stretch lg:min-h-0 lg:flex-1"
        }`}
      >
        <div
          className={`mx-auto flex w-full min-w-0 max-w-[min(100%,360px)] flex-col gap-2 max-lg:mx-0 max-lg:w-full max-lg:max-w-none max-lg:gap-1 max-lg:min-h-0 max-lg:flex-1 max-lg:overflow-hidden lg:mx-0 lg:max-w-[307px]`}
        >
          {mobileCoverBelowMetrics != null ? (
            <div className="w-full min-w-0 max-lg:block lg:hidden">
              {mobileCoverBelowMetrics}
            </div>
          ) : imageUrl ? (
            wrapCover(
              <CollectionCoverFrame
                imageUrl={imageUrl}
                alt=""
                variant="hero"
                className="relative z-[1] w-full shrink-0 overflow-visible max-lg:ms-auto max-lg:shrink-0 lg:w-full"
                coverGallery={coverGallery}
              />,
            )
          ) : (
            <div
              className={`flex h-[min(460px,82vw)] max-h-[min(480px,88svh)] w-full items-center justify-center rounded-2xl ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS} p-6 text-center text-[12px] text-gray-500 lg:w-[307px] ${COLLECTION_HERO_DESKTOP_HEIGHT_CLASS}`}
            >
              No preview
            </div>
          )}
        </div>
        {belowCover != null ? (
          <div className="hidden w-full min-w-0 lg:mt-0 lg:block">{belowCover}</div>
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
