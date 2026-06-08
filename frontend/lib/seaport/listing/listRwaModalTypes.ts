import type { Order } from "@/lib/core";
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
}

export interface InstantMatchDecision {
  shouldRun: boolean;
  enforceImmediateFill: boolean;
}

export interface ListRwaModalProps {
  tokenId: number;
  assetTitle?: string | null;
  onClose: () => void;
  onMatchedSale?: () => void;
  onListed?: (tokenId: number) => void;
  initialPriceUsdc?: string | null;
  existingAskOrder?: Order | null;
  existingAskOrderHash?: string | null;
  collectionKey?: string | null;
  collectionBids?: Order[];
  preferredBidOrderHash?: string | null;
}
