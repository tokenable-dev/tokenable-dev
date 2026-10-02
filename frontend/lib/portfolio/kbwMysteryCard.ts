import { ASSETS } from "@/constants/assets";
import type { RwaMetadata } from "@/lib/core";
import type { PricedAssetRow } from "@/lib/portfolio/portfolioTypes";

/** Reserved synthetic id — not an on-chain token. */
export const KBW_MYSTERY_CARD_TOKEN_ID = -717_171;

export const KBW_MYSTERY_CARD_NAME = "Mystery Card";

export function isKbwMysteryCardTokenId(tokenId: number): boolean {
  return tokenId === KBW_MYSTERY_CARD_TOKEN_ID;
}

/** Portfolio + burn modal — official unused/used pack art (same canvas). */
export function kbwMysteryCardImageUrl(used = false): string {
  return used
    ? ASSETS.event.kbwMysteryPackUsed
    : ASSETS.event.kbwMysteryPackUnused;
}

export function buildKbwMysteryCardRow(used = false): PricedAssetRow {
  return {
    tokenId: KBW_MYSTERY_CARD_TOKEN_ID,
    name: KBW_MYSTERY_CARD_NAME,
    imageUrl: kbwMysteryCardImageUrl(used),
    category: null,
    amount: 1,
    currentPrice: null,
    priceSource: "none",
    liquidityLabel: null,
    listPriceUsd: null,
    activeListingOrderHash: null,
    setName: null,
    marketPreviewRaw: null,
    sparkline1y: [],
    kbwMysteryUsed: used,
  };
}

export function buildKbwMysteryCardMetadata(used = false): RwaMetadata {
  return {
    name: KBW_MYSTERY_CARD_NAME,
    description: "Event mystery card (collectible).",
    image: kbwMysteryCardImageUrl(used),
  };
}
