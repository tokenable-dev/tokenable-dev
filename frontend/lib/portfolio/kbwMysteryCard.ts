import { ASSETS } from "@/constants/assets";
import type { RwaMetadata } from "@/lib/core";
import type { PricedAssetRow } from "@/lib/portfolio/portfolioTypes";

/** Reserved synthetic id — not an on-chain token. */
export const KBW_MYSTERY_CARD_TOKEN_ID = -717_171;

export const KBW_MYSTERY_CARD_NAME = "KBW Mystery Card";

export function isKbwMysteryCardTokenId(tokenId: number): boolean {
  return tokenId === KBW_MYSTERY_CARD_TOKEN_ID;
}

export function kbwMysteryCardImageUrl(used = false): string {
  return used
    ? ASSETS.event.kbwMysteryCardRedeemed
    : ASSETS.event.kbwMysteryCard;
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
    description: "Korea Blockchain Week mystery card (event collectible).",
    image: kbwMysteryCardImageUrl(used),
  };
}
