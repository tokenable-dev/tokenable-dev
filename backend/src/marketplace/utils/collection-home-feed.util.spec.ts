import {
  pickHomeTickerKeys,
  pickHomeTopMoverKeys,
  pickJustVaultedKeys,
  uniqueKeysInOrder,
} from './collection-home-feed.util';

describe('collection-home-feed.util', () => {
  it('ranks top movers by 90d gain, positive only', () => {
    expect(
      pickHomeTopMoverKeys(
        [
          { collectionKey: 'a', pct90d: 1 },
          { collectionKey: 'b', pct90d: 5 },
          { collectionKey: 'c', pct90d: -2 },
          { collectionKey: 'd', pct90d: null },
        ],
        2,
      ),
    ).toEqual(['b', 'a']);
  });

  it('ranks ticker by absolute 1Y change', () => {
    expect(
      pickHomeTickerKeys(
        [
          { collectionKey: 'a', changePct: 2 },
          { collectionKey: 'b', changePct: -9 },
          { collectionKey: 'c', changePct: 3 },
        ],
        2,
      ),
    ).toEqual(['b', 'c']);
  });

  it('picks newest vaulted by createdAt', () => {
    expect(
      pickJustVaultedKeys(
        [
          { collectionKey: 'old', createdAtMs: 1 },
          { collectionKey: 'new', createdAtMs: 9 },
          { collectionKey: 'mid', createdAtMs: 5 },
        ],
        2,
      ),
    ).toEqual(['new', 'mid']);
  });

  it('dedupes keys keeping first-seen order', () => {
    expect(uniqueKeysInOrder([['a', 'b'], ['b', 'c']])).toEqual(['a', 'b', 'c']);
  });
});
