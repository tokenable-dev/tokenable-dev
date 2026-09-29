const SECONDS_PER_DAY = 24 * 60 * 60;

export const TOKEN_BID_DURATION_DAYS = [1, 3, 7, 14, 30, 60, 90, 180] as const;
export type TokenBidDurationDays = (typeof TOKEN_BID_DURATION_DAYS)[number];
export const TOKEN_BID_DEFAULT_DURATION_DAYS: TokenBidDurationDays = 30;
/** Place-a-bid modal chips (Card.html #tkb-expiry). */
export const TOKEN_BID_UI_DURATION_DAYS = [1, 7, 30] as const satisfies readonly TokenBidDurationDays[];

export function isTokenBidDurationDays(
  days: number,
): days is TokenBidDurationDays {
  return (TOKEN_BID_DURATION_DAYS as readonly number[]).includes(days);
}

/** Coerce UI / form values; rejects non-allowed windows instead of silently using 7d. */
export function resolveTokenBidDurationDays(
  days: number | string | null | undefined,
): TokenBidDurationDays {
  const n = typeof days === "number" ? days : Number(days);
  if (!isTokenBidDurationDays(n)) {
    throw new Error(
      `Bid duration must be one of ${TOKEN_BID_DURATION_DAYS.join(", ")} days`,
    );
  }
  return n;
}

export function tokenBidDurationSeconds(days: TokenBidDurationDays): number {
  return days * SECONDS_PER_DAY;
}

export function tokenBidDurationOptionLabel(days: TokenBidDurationDays): string {
  return days === 1 ? "1 day" : `${days} days`;
}
