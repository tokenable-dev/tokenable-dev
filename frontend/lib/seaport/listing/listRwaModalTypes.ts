import type { Order } from "@/lib/core";
import type { AssetDetailHeadlineParts } from "@/lib/marketplace/assetDetailHeadline";
import type { MatchFailureCode } from "@/lib/seaport/fulfillment/runCriteriaMatch";

export type ListRwaModalStep =
  | "idle"
  | "approving"
  | "signing"
  | "submitting"
  | "matching"
  | "success"
  | "error";

export interface ListSuccessMeta {
  matched: boolean;
  hint?: string;
  reasonCode?: MatchFailureCode;
  instantOnlyCancelled?: boolean;
  /**
   * Buyer could not fund the bid (USDC balance/allowance). Ask stays at the
   * price the seller just set; dead bid should be invalidated.
   */
  keptAskAfterBuyerFundingFail?: boolean;
  /** Bid that failed match — used to invalidate a dead offer. */
  failedBidOrderHash?: string;
  /** New collection bucket awaiting admin Markets approval. */
  collectionUnderReview?: boolean;
}

export interface InstantMatchDecision {
  shouldRun: boolean;
  enforceImmediateFill: boolean;
}

export type ListRwaModalShell = "modal" | "sheet";

export interface ListRwaModalProps {
  tokenId: number;
  assetTitle?: string | null;
  /** Set/Edit price sheet — card name / number / grade under the eyebrow. */
  headlineParts?: AssetDetailHeadlineParts | null;
  headlineGrade?: string | null;
  onClose: () => void;
  onMatchedSale?: () => void;
  onListed?: (tokenId: number) => void;
  initialPriceUsdc?: string | null;
  existingAskOrder?: Order | null;
  existingAskOrderHash?: string | null;
  collectionKey?: string | null;
  collectionBids?: Order[];
  preferredBidOrderHash?: string | null;
  /** Market value shown in Set/Edit price drawer (Portfolio v2). */
  marketValueUsd?: number | null;
  /** Listed ask amount for “Currently listed at” (Portfolio v2). */
  listedPriceUsd?: number | null;
  /** Opens cancel-listing confirm (Portfolio Edit price drawer). */
  onRequestCancelListing?: () => void;
  /** `sheet` — bottom `TkActionSheet` (RWA detail); default centered modal. */
  shell?: ListRwaModalShell;
  /** Portfolio Set price / Edit price copy (design system-2). */
  copyVariant?: "default" | "set-price";
}
