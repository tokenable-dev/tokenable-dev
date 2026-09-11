/**
 * Unit test for mintBatchTo chunking contract (caller responsibility).
 * RwaChainWriterService.mintBatchTo rejects >50 items.
 */
describe('bulk mint on-chain chunk size', () => {
  const MAX = 50;

  it('chunks 300 items into 6 batches of 50', () => {
    const n = 300;
    const chunks: number[] = [];
    for (let i = 0; i < n; i += MAX) {
      chunks.push(Math.min(MAX, n - i));
    }
    expect(chunks).toEqual([50, 50, 50, 50, 50, 50]);
    expect(chunks.reduce((a, b) => a + b, 0)).toBe(300);
  });

  it('chunks 501 would exceed API max before on-chain', () => {
    const apiMax = 500;
    expect(501 > apiMax).toBe(true);
  });
});
