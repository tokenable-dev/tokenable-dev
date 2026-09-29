/** Stable import path; implementation lives in `lib/seaport/bid/`. */
export {
  TOKEN_BID_DURATION_DAYS,
  TOKEN_BID_DEFAULT_DURATION_DAYS,
  TOKEN_BID_UI_DURATION_DAYS,
  isTokenBidDurationDays,
  resolveTokenBidDurationDays,
  tokenBidDurationSeconds,
  tokenBidDurationOptionLabel,
  type TokenBidDurationDays,
} from "@/lib/seaport/bid/tokenBidDuration";

export {
  submitTokenBid,
  submitCollectionCriteriaBid,
  type TokenBidSubmitResult,
} from "@/lib/seaport/bid/submitBids";
