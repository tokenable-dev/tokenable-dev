/** Allowed Seaport `endTime − startTime` windows for token bids. */
export const TOKEN_BID_ALLOWED_DURATION_DAYS = [
  1, 3, 7, 14, 30, 60, 90, 180,
] as const;
export const TOKEN_BID_SECONDS_PER_DAY = 86_400;
/** Chain vs server clock + signing delay. */
export const TOKEN_BID_DURATION_SKEW_SEC = 120;
export const TOKEN_BID_START_SKEW_SEC = 15 * 60;
export const TOKEN_BID_MAX_DURATION_DAYS = 180;

export function isAllowedTokenBidDurationSec(durationSec: number): boolean {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return false;
  return TOKEN_BID_ALLOWED_DURATION_DAYS.some(
    (d) =>
      Math.abs(durationSec - d * TOKEN_BID_SECONDS_PER_DAY) <=
      TOKEN_BID_DURATION_SKEW_SEC,
  );
}

export function tokenBidWindowIsValid(input: {
  startTimeSec: number;
  endTimeSec: number;
  nowSec: number;
}): { ok: true } | { ok: false; reason: string } {
  const { startTimeSec, endTimeSec, nowSec } = input;
  if (
    !Number.isFinite(startTimeSec) ||
    !Number.isFinite(endTimeSec) ||
    !Number.isFinite(nowSec)
  ) {
    return { ok: false, reason: 'Bid startTime and endTime must be numbers' };
  }
  if (endTimeSec <= startTimeSec) {
    return { ok: false, reason: 'Bid endTime must be after startTime' };
  }
  if (Math.abs(startTimeSec - nowSec) > TOKEN_BID_START_SKEW_SEC) {
    return { ok: false, reason: 'Bid startTime is too far from now' };
  }
  const durationSec = endTimeSec - startTimeSec;
  if (!isAllowedTokenBidDurationSec(durationSec)) {
    return {
      ok: false,
      reason:
        'Bid duration must be 1, 3, 7, 14, 30, 60, 90, or 180 days',
    };
  }
  const maxEnd =
    nowSec +
    TOKEN_BID_MAX_DURATION_DAYS * TOKEN_BID_SECONDS_PER_DAY +
    TOKEN_BID_DURATION_SKEW_SEC;
  if (endTimeSec > maxEnd) {
    return { ok: false, reason: 'Bid endTime exceeds the 180-day maximum' };
  }
  return { ok: true };
}
