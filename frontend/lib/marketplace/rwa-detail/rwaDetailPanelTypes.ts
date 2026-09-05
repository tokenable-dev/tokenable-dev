import type { ReactNode } from "react";
import type { RwaDetailMetadata } from "./rwaDetailMetadata";

export interface RwaDetailAssetPanelProps {
  metadata: RwaDetailMetadata | null;
  imageUrl: string | null;
  imageBackUrl?: string | null;
  tokenId: number;
  collectionLabel: string;
  metaLoading?: boolean;
  priceMetricsSlot?: ReactNode;
  mobileHeroTradingSlot?: ReactNode;
  /** Mobile openSea — slab label directly under hero image (image width, not controls row). */
  mobileSlabCaptionSlot?: ReactNode;
  hideHeaderOnXl?: boolean;
  openSeaMobile?: boolean;
}
