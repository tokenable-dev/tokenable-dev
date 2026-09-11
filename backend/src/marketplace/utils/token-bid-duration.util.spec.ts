import {
  isAllowedTokenBidDurationSec,
  TOKEN_BID_SECONDS_PER_DAY,
  tokenBidWindowIsValid,
} from './token-bid-duration.util';

describe('token bid duration window', () => {
  const now = 1_700_000_000;

  it('accepts the allowed day lengths', () => {
    for (const days of [1, 3, 7, 14, 30, 60, 90, 180]) {
      expect(isAllowedTokenBidDurationSec(days * TOKEN_BID_SECONDS_PER_DAY)).toBe(
        true,
      );
      expect(
        tokenBidWindowIsValid({
          startTimeSec: now,
          endTimeSec: now + days * TOKEN_BID_SECONDS_PER_DAY,
          nowSec: now,
        }),
      ).toEqual({ ok: true });
    }
  });

  it('rejects a 2-day window and a 365-day window', () => {
    expect(isAllowedTokenBidDurationSec(2 * TOKEN_BID_SECONDS_PER_DAY)).toBe(
      false,
    );
    expect(
      tokenBidWindowIsValid({
        startTimeSec: now,
        endTimeSec: now + 365 * TOKEN_BID_SECONDS_PER_DAY,
        nowSec: now,
      }).ok,
    ).toBe(false);
  });
});
