"use client";

import type { RwaDetailAssetPanelProps } from "@/lib/marketplace/rwa-detail";
import { useRwaDetailSlabPanel } from "@/hooks/rwa-detail-asset-panel";
import { RwaDetailAssetPanelHeader } from "./RwaDetailAssetPanelHeader";
import { RwaDetailSlabSection } from "./slab/RwaDetailSlabSection";

/**
 * 마켓플레이스 RWA 상세 — 카드 메타·슬랩·스탯
 */
export function RwaDetailAssetPanel({
  metadata,
  imageUrl,
  tokenId,
  collectionLabel,
  metaLoading,
  priceMetricsSlot,
  mobileHeroTradingSlot,
  hideHeaderOnXl = false,
  openSeaMobile = false,
}: RwaDetailAssetPanelProps) {
  const slab = useRwaDetailSlabPanel({
    metadata,
    imageUrl,
    tokenId,
    collectionLabel,
    metaLoading,
    openSeaMobile,
  });

  return (
    <div
      className={`flex min-w-0 flex-col gap-4 max-xl:gap-3 lg:gap-5 ${
        openSeaMobile
          ? "max-lg:items-center max-lg:gap-0 max-lg:px-0 max-lg:pt-0 max-lg:text-center lg:items-start lg:pt-0"
          : ""
      }`}
    >
      {!openSeaMobile ? (
        <RwaDetailAssetPanelHeader
          metadata={metadata}
          headlineParts={slab.headlineParts}
          headerRowPulse={slab.headerRowPulse}
          titlePulse={slab.titlePulse}
          hideHeaderOnXl={hideHeaderOnXl}
          openSeaMobile={openSeaMobile}
        />
      ) : null}

      {priceMetricsSlot && !openSeaMobile ? (
        <div className="max-xl:order-2 lg:order-none">{priceMetricsSlot}</div>
      ) : null}

      <RwaDetailSlabSection
        imageUrl={imageUrl}
        openSeaMobile={openSeaMobile}
        mobileHeroTradingSlot={mobileHeroTradingSlot}
        slab={slab}
      />
    </div>
  );
}
