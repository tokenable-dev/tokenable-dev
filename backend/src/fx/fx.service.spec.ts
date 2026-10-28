import { FxService } from './fx.service';
import { runWithPgSessionAdvisoryLock } from '../database/pg-session-advisory-lock.util';

jest.mock('../database/pg-session-advisory-lock.util', () => ({
  runWithPgSessionAdvisoryLock: jest.fn(),
}));

const lock = runWithPgSessionAdvisoryLock as jest.MockedFunction<
  typeof runWithPgSessionAdvisoryLock
>;

const QUOTES = [
  'EUR',
  'GBP',
  'KRW',
  'JPY',
  'SGD',
  'CAD',
  'AUD',
  'CHF',
  'HKD',
  'CNY',
  'IDR',
  'MYR',
  'PHP',
  'THB',
] as const;

function rows(date: string, krw = 1325.28) {
  const fetchedAt = new Date('2026-10-27T16:00:00.000Z');
  const rates: Record<string, number> = {
    EUR: 0.89,
    GBP: 0.75,
    KRW: krw,
    JPY: 150,
    SGD: 1.28,
    CAD: 1.4,
    AUD: 1.5,
    CHF: 0.8,
    HKD: 7.8,
    CNY: 7.12,
    IDR: 18163,
    MYR: 4.08,
    PHP: 63.9,
    THB: 33.8,
  };
  return QUOTES.map((currency) => ({
    currency,
    quotePerUsd: String(rates[currency]),
    observationDate: date,
    fetchedAt,
    source: 'frankfurter-ecb',
  }));
}

describe('FxService multi-process refresh', () => {
  const find = jest.fn();
  const query = jest.fn();
  const release = jest.fn();
  const dataSource = {
    createQueryRunner: () => ({
      connect: async () => undefined,
      query,
      release,
    }),
  };

  beforeEach(() => {
    find.mockReset();
    query.mockReset();
    query.mockResolvedValue([]);
    release.mockReset();
    lock.mockReset();
  });

  function service() {
    return new FxService({ find } as never, dataSource as never);
  }

  it('reloads the committed database snapshot when the refresh lock is held', async () => {
    lock.mockResolvedValue({ acquired: false });
    find.mockResolvedValue(rows('2026-10-26', 1400));
    const fx = service();

    const result = await fx.refresh('peer');

    expect(result).toEqual({ updated: false, skippedLock: true });
    expect(query).toHaveBeenCalledWith('SELECT pg_advisory_lock($1)', [710271001]);
    expect(query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1)', [710271001]);
    expect(fx.getCached().observationDate).toBe('2026-10-26');
    expect(fx.getCached().rates.KRW).toBe(1400);
    expect(fx.getCached().rates.USD).toBe(1);
    expect(fx.getCached().rates.EUR).toBe(0.89);
    expect(fx.getCached().rates.VND).toBeUndefined();
  });

  it('attaches a stored VND rate without requiring it in the ECB set', async () => {
    lock.mockResolvedValue({ acquired: false });
    find.mockResolvedValue([
      ...rows('2026-10-26'),
      {
        currency: 'VND',
        quotePerUsd: '25858',
        observationDate: '2026-10-27',
        fetchedAt: new Date('2026-10-27T16:00:00.000Z'),
        source: 'frankfurter-bnm',
      },
    ]);
    const fx = service();
    await fx.refresh('vnd');
    expect(fx.getCached().rates.VND).toBe(25858);
    expect(fx.getCached().rates.IDR).toBe(18163);
  });

  it('keeps the last complete snapshot when the database read is partial', async () => {
    lock.mockResolvedValue({ acquired: false });
    find.mockResolvedValueOnce(rows('2026-10-26'));
    const fx = service();
    await fx.refresh('first');
    find.mockResolvedValueOnce(rows('2026-10-27').filter((row) => row.currency !== 'KRW'));

    await fx.refresh('second');

    expect(fx.getCached().observationDate).toBe('2026-10-26');
    expect(fx.getCached().rates.KRW).toBe(1325.28);
  });

  it('keeps the last snapshot when the upstream fetch fails', async () => {
    find.mockResolvedValue(rows('2026-10-26'));
    lock.mockResolvedValue({ acquired: false });
    const fx = service();
    await fx.refresh('seed');

    const fetchMock = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('down'));
    lock.mockImplementation(async (_ds, _key, fn) => {
      await fn();
      return { acquired: true, value: true };
    });

    await expect(fx.refresh('failed-fetch')).rejects.toThrow('down');
    expect(fx.getCached().rates.KRW).toBe(1325.28);
    expect(fx.getCached().observationDate).toBe('2026-10-26');
    fetchMock.mockRestore();
  });
});
