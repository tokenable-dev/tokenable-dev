import { pickCrossingAskForBid } from './bid-crosses-ask.util';

describe('pickCrossingAskForBid', () => {
  const now = Date.now();
  const future = new Date(now + 86_400_000);
  const pastStart = new Date(now - 60_000);

  it('picks the cheapest live ask the bid would take', () => {
    const picked = pickCrossingAskForBid(
      [
        {
          orderHash: '0xhigh',
          offerer: '0xseller2',
          considerationAmount: '900000000',
          tokenId: '9',
          startTime: pastStart,
          endTime: future,
        },
        {
          orderHash: '0xlow',
          offerer: '0xseller1',
          considerationAmount: '697000000',
          tokenId: '3',
          startTime: pastStart,
          endTime: future,
        },
      ],
      '0xbuyer',
      888_000_000n,
      now,
    );
    expect(picked?.orderHash).toBe('0xlow');
  });

  it('returns null when the bid is below every other ask', () => {
    expect(
      pickCrossingAskForBid(
        [
          {
            offerer: '0xseller',
            considerationAmount: '697000000',
            startTime: pastStart,
            endTime: future,
          },
        ],
        '0xbuyer',
        500_000_000n,
        now,
      ),
    ).toBeNull();
  });

  it('picks the bidder own ask when it is the cheapest the bid would take', () => {
    const picked = pickCrossingAskForBid(
      [
        {
          orderHash: '0xown',
          offerer: '0xBuyer',
          considerationAmount: '100000000',
          tokenId: '1',
          startTime: pastStart,
          endTime: future,
        },
        {
          orderHash: '0xother',
          offerer: '0xseller',
          considerationAmount: '200000000',
          tokenId: '2',
          startTime: pastStart,
          endTime: future,
        },
      ],
      '0xbuyer',
      888_000_000n,
      now,
    );
    expect(picked?.orderHash).toBe('0xown');
  });
});
