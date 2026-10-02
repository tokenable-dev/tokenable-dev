import { OrderSide } from '../entities/order.entity';
import {
  isCriteriaCollectionBidOrder,
  isDeadTokenBidFunding,
  isTokenBidOrder,
} from './platform-tape.util';

describe('platform-tape bid shape helpers', () => {
  it('detects token bids (itemType 2 consideration)', () => {
    expect(
      isTokenBidOrder({
        side: OrderSide.BID,
        parameters: {
          offer: [{ itemType: 1 }],
          consideration: [{ itemType: 2, identifierOrCriteria: '42' }],
        },
      }),
    ).toBe(true);
  });

  it('rejects criteria bids as token bids', () => {
    const criteria = {
      side: OrderSide.BID,
      parameters: {
        offer: [{ itemType: 1 }],
        consideration: [{ itemType: 4 }],
      },
    };
    expect(isTokenBidOrder(criteria)).toBe(false);
    expect(isCriteriaCollectionBidOrder(criteria)).toBe(true);
  });
});

describe('isDeadTokenBidFunding', () => {
  const needed = BigInt(38_000_000);

  it('marks underfunded when balance is short', () => {
    expect(
      isDeadTokenBidFunding({
        balance: BigInt(10_000_000),
        allowance: needed,
        needed,
        nowSec: 1_000,
        endTimeSec: 9_999,
      }),
    ).toEqual({ dead: true, reason: 'underfunded' });
  });

  it('marks underfunded when allowance is short', () => {
    expect(
      isDeadTokenBidFunding({
        balance: needed,
        allowance: BigInt(0),
        needed,
        nowSec: 1_000,
        endTimeSec: 9_999,
      }),
    ).toEqual({ dead: true, reason: 'underfunded' });
  });

  it('marks expired when past endTime', () => {
    expect(
      isDeadTokenBidFunding({
        balance: needed,
        allowance: needed,
        needed,
        nowSec: 5_000,
        endTimeSec: 4_000,
      }),
    ).toEqual({ dead: true, reason: 'expired' });
  });

  it('keeps fundable active bids alive', () => {
    expect(
      isDeadTokenBidFunding({
        balance: needed,
        allowance: needed,
        needed,
        nowSec: 1_000,
        endTimeSec: 9_999,
      }),
    ).toEqual({ dead: false, reason: null });
  });
});
