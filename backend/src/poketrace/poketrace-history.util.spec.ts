import { parsePokeTraceHistoryBody } from './poketrace-history.util';

describe('parsePokeTraceHistoryBody', () => {
  it('reads nextCursor from pagination (OpenAPI 1.5)', () => {
    const { points, nextCursor } = parsePokeTraceHistoryBody({
      data: [
        { date: '2026-01-01', avg: 10, source: 'ebay' },
        { date: '2026-01-02', avg: 12, source: 'ebay' },
      ],
      pagination: { hasMore: true, nextCursor: 'abc', count: 2 },
    });
    expect(points.length).toBe(2);
    expect(nextCursor).toBe('abc');
  });

  it('clears cursor when pagination.hasMore is false', () => {
    const { nextCursor } = parsePokeTraceHistoryBody({
      data: [{ date: '2026-01-01', avg: 5, source: 'ebay' }],
      pagination: { hasMore: false, nextCursor: 'x', count: 1 },
    });
    expect(nextCursor).toBeNull();
  });
});
