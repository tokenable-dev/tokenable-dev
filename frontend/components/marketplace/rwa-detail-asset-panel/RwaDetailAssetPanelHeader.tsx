"use client";

import { AssetDetailHeadlineTitle } from "@/components/marketplace/marketplace-shared";
import {
  assetDetailHeadlineHasContent,
  formatCardDisplayMeta,
  resolveRwaHeadlineGrade,
} from "@/lib/marketplace/assetDetailHeadline";
import type { RwaDetailMetadata } from "@/lib/marketplace/rwa-detail";
import { rwaDetailRightFont } from "@/components/marketplace/rwa-detail/theme";
import { RwaDetailHeaderBadges } from "./ui/RwaDetailHeaderBadges";

export function RwaDetailAssetPanelHeader({
  metadata,
  headlineParts,
  headerRowPulse,
  titlePulse,
  hideHeaderOnXl,
  openSeaMobile,
}: {
  metadata: RwaDetailMetadata | null;
  headlineParts: ReturnType<
    typeof import("@/lib/marketplace/assetDetailHeadline").buildRwaAssetDetailHeadlineParts
  >;
  headerRowPulse: boolean;
  titlePulse: boolean;
  hideHeaderOnXl?: boolean;
  openSeaMobile?: boolean;
}) {
  const grade = resolveRwaHeadlineGrade(metadata);
  const metaText = formatCardDisplayMeta(headlineParts);

  return (
    <div
      className={`${rwaDetailRightFont.className} ${
        openSeaMobile
          ? "hidden space-y-2 px-0.5 lg:block lg:px-0"
          : hideHeaderOnXl
            ? "space-y-2 px-0.5 max-xl:order-3 lg:order-none lg:px-0 lg:hidden"
            : "space-y-2 px-0.5 max-xl:order-3 lg:order-none lg:px-0"
      }`}
    >
      <RwaDetailHeaderBadges metadata={metadata} loading={headerRowPulse} variant="mobile" />

      {titlePulse ? (
        <div
          className="h-7 w-[min(100%,18rem)] max-w-full animate-pulse rounded-lg bg-gray-800/85"
          aria-hidden
        />
      ) : assetDetailHeadlineHasContent(headlineParts) ? (
        <div className="min-w-0 space-y-1">
          <AssetDetailHeadlineTitle
            as="h1"
            parts={headlineParts}
            grade={grade}
            className="text-xl font-medium leading-snug tracking-normal text-white sm:text-[1.375rem]"
          />
          {metaText ? (
            <p className="m-0 text-[13px] font-medium tracking-tight text-white/55">{metaText}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
