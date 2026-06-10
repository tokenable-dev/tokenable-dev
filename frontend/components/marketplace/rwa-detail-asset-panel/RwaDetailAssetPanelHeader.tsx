"use client";

import { AssetDetailHeadlineTitle } from "@/components/marketplace/marketplace-shared";
import { assetDetailHeadlineHasContent } from "@/lib/marketplace/assetDetailHeadline";
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
        <AssetDetailHeadlineTitle
          as="h1"
          parts={headlineParts}
          className="text-xl font-medium leading-snug tracking-normal text-white sm:text-[1.375rem]"
        />
      ) : null}
    </div>
  );
}
