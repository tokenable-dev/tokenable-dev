import {
  pickHomeTickerKeys,
  pickHomeTopMoverKeys,
  pickJustVaultedKeys,
  uniqueKeysInOrder,
} from './collection-home-feed.util';

describe('collection-home-feed.util', () => {
  it('ranks top movers by stored reference gain, whole-percent rises only', () => {
    expect(
      pickHomeTopMoverKeys(
        [
          { collectionKey: 'a', changePct: 1.2 },
          { collectionKey: 'b', changePct: 12.4 },
          { collectionKey: 'c', changePct: -2 },
          { collectionKey: 'd', changePct: null },
          { collectionKey: 'e', changePct: 0.4 },
          { collectionKey: 'f', changePct: 0.6 },
        ],
        10,
      ),
    ).toEqual(['b', 'a', 'f']);
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
