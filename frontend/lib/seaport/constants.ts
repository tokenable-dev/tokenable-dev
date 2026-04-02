/** Seaport `ItemType` (Seaport 1.5) */
export const SeaportItemType = {
  NATIVE: 0,
  ERC20: 1,
  ERC721: 2,
  ERC1155: 3,
  ERC721_WITH_CRITERIA: 4,
  ERC1155_WITH_CRITERIA: 5,
} as const;

/** `Side` in `CriteriaResolver` / fulfillment */
export const SeaportSide = {
  OFFER: 0,
  CONSIDERATION: 1,
} as const;
