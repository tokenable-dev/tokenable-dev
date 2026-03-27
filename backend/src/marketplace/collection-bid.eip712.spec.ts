import { bucketKeyHexToBytes32 } from './collection-bid.eip712';

describe('collection-bid.eip712', () => {
  it('bucketKeyHexToBytes32 accepts 64 hex', () => {
    const h = 'a'.repeat(64);
    expect(bucketKeyHexToBytes32(h)).toBe(`0x${h}`);
  });

  it('bucketKeyHexToBytes32 rejects invalid', () => {
    expect(() => bucketKeyHexToBytes32('abc')).toThrow();
  });
});
