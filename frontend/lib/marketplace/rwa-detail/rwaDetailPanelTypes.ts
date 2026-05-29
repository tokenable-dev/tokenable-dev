import type { ReactNode } from "react";
import type { RwaDetailMetadata } from "./rwaDetailMetadata";

export interface RwaDetailAssetPanelProps {
  metadata: RwaDetailMetadata | null;
  imageUrl: string | null;
  tokenId: number;
  collectionLabel: string;
  metaLoading?: boolean;
  priceMetricsSlot?: ReactNode;
  mobileHeroTradingSlot?: ReactNode;
  hideHeaderOnXl?: boolean;
  openSeaMobile?: boolean;
}
