import {
  isObservationStale,
  parseEcbRatesPayload,
  parseUsdQuote,
  publishableFxSnapshot,
  supplementaryVndRate,
} from './fx-ecb';

const SAMPLE = [
  { date: '2026-10-26', base: 'USD', quote: 'EUR', rate: 0.89381 },
  { date: '2026-10-26', base: 'USD', quote: 'GBP', rate: 0.7492 },
  { date: '2026-10-26', base: 'USD', quote: 'KRW', rate: 1325.28 },
  { date: '2026-10-26', base: 'USD', quote: 'JPY', rate: 157.45 },
  { date: '2026-10-26', base: 'USD', quote: 'SGD', rate: 1.2806 },
  { date: '2026-10-26', base: 'USD', quote: 'CAD', rate: 1.4028 },
  { date: '2026-10-26', base: 'USD', quote: 'AUD', rate: 1.4236 },
  { date: '2026-10-26', base: 'USD', quote: 'CHF', rate: 0.82615 },
  { date: '2026-10-26', base: 'USD', quote: 'HKD', rate: 7.8448 },
  { date: '2026-10-26', base: 'USD', quote: 'IDR', rate: 18163 },
  { date: '2026-10-26', base: 'USD', quote: 'MYR', rate: 4.0875 },
  { date: '2026-10-26', base: 'USD', quote: 'PHP', rate: 63.944 },
  { date: '2026-10-26', base: 'USD', quote: 'THB', rate: 33.805 },
];

describe('parseEcbRatesPayload', () => {
  it('keeps the observation date and quote-per-USD rates', () => {
    const parsed = parseEcbRatesPayload(SAMPLE);
    expect(parsed.observationDate).toBe('2026-10-26');
    expect(parsed.quotePerUsd.KRW).toBe(1325.28);
    expect(parsed.quotePerUsd.EUR).toBe(0.89381);
  });

  it('rejects a weekend-style payload that drops a required currency', () => {
    expect(() => parseEcbRatesPayload(SAMPLE.filter((row) => row.quote !== 'KRW'))).toThrow(
      /KRW/,
    );
  });

  it('rejects a non-positive rate', () => {
    const rows = SAMPLE.map((row) =>
      row.quote === 'JPY' ? { ...row, rate: 0 } : row,
    );
    expect(() => parseEcbRatesPayload(rows)).toThrow(/JPY/);
  });
});

describe('publishableFxSnapshot', () => {
  const fetchedAt = new Date('2026-10-27T15:30:00.000Z');
  const complete = SAMPLE.map((row) => ({
    currency: row.quote,
    quotePerUsd: row.rate,
    observationDate: row.date,
    fetchedAt,
  }));

  it('publishes one observation date for every allowlisted currency', () => {
    const snap = publishableFxSnapshot(complete);
    expect(snap?.observationDate).toBe('2026-10-26');
    expect(snap?.quotePerUsd.EUR).toBe(0.89381);
    expect(snap?.quotePerUsd.KRW).toBe(1325.28);
    expect(Object.keys(snap?.quotePerUsd ?? {})).toHaveLength(13);
    expect(snap?.quotePerUsd.VND).toBeUndefined();
  });

  it('does not blend a newer partial set with an older complete set', () => {
    const older = complete.map((row) => ({
      ...row,
      observationDate: '2026-10-23',
    }));
    const newerPartial = complete
      .filter((row) => row.currency !== 'KRW')
      .map((row) => ({ ...row, observationDate: '2026-10-26' }));
    const snap = publishableFxSnapshot([...older, ...newerPartial]);
    expect(snap?.observationDate).toBe('2026-10-23');
    expect(snap?.quotePerUsd.KRW).toBe(1325.28);
    expect(snap?.quotePerUsd.EUR).toBe(0.89381);
  });

  it('keeps a stored VND rate out of the ECB completeness check', () => {
    expect(publishableFxSnapshot(complete)?.quotePerUsd.IDR).toBe(18163);
    expect(
      supplementaryVndRate([
        ...complete,
        {
          currency: 'VND',
          quotePerUsd: '25858',
          observationDate: '2026-10-27',
          fetchedAt,
        },
      ]),
    ).toBe(25858);
    expect(parseUsdQuote([], 'VND')).toBeNull();
    expect(
      parseUsdQuote(
        [{ date: '2026-10-27', base: 'USD', quote: 'VND', rate: 25858 }],
        'VND',
      ),
    ).toEqual({ date: '2026-10-27', rate: 25858 });
  });

  it('returns null when no date has the full set', () => {
    expect(publishableFxSnapshot(complete.filter((row) => row.currency !== 'JPY'))).toBeNull();
  });
});

describe('isObservationStale', () => {
  it('treats a Friday rate as current on the following Monday', () => {
    expect(isObservationStale('2026-10-23', new Date('2026-10-26T12:00:00Z'))).toBe(
      false,
    );
  });

  it('marks a rate older than five calendar days as stale', () => {
    expect(isObservationStale('2026-10-20', new Date('2026-10-26T12:00:00Z'))).toBe(
      true,
    );
  });
});
