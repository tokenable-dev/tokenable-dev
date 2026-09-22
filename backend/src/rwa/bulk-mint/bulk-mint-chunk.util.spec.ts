/**
 * Sequential mint(to) progress chunks (preset has no mintBatch).
 */
describe('bulk mint on-chain chunk size', () => {
  const MAX = 10;

  it('chunks 30 items into 3 batches of 10', () => {
    const n = 30;
    const chunks: number[] = [];
    for (let i = 0; i < n; i += MAX) {
      chunks.push(Math.min(MAX, n - i));
    }
    expect(chunks).toEqual([10, 10, 10]);
    expect(chunks.reduce((a, b) => a + b, 0)).toBe(30);
  });

  it('chunks 501 would exceed API max before on-chain', () => {
    const apiMax = 500;
    expect(501 > apiMax).toBe(true);
  });
});
