import { OrderSide } from '../entities/order.entity';
import {
  isCriteriaCollectionBidOrder,
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
