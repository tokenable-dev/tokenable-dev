import {
  normalizePsaCertDigits,
  pickCollectionPsaCertNumber,
} from '../utils/collection-row.util';

describe('pickCollectionPsaCertNumber', () => {
  it('returns null for empty hits', () => {
    expect(pickCollectionPsaCertNumber([], null)).toBeNull();
  });

  it('keeps current cert when still among active listings', () => {
    expect(
      pickCollectionPsaCertNumber(
        [
          { cert: '111', considerationAmount: '1000000' },
          { cert: '222', considerationAmount: '500000' },
        ],
        '111',
      ),
    ).toBe('111');
  });

  it('matches current by digits-only (formatting variants)', () => {
    expect(
      pickCollectionPsaCertNumber(
        [{ cert: '71203344', considerationAmount: '1' }],
        '71-203-344',
      ),
    ).toBe('71203344');
  });

  it('picks floor ask cert when current is missing or stale', () => {
    expect(
      pickCollectionPsaCertNumber(
        [
          { cert: '90000001', considerationAmount: '9000000000' },
          { cert: '10000001', considerationAmount: '1000000' },
          { cert: '50000001', considerationAmount: '5000000000' },
        ],
        'gone',
      ),
    ).toBe('10000001');
  });

  it('picks sole cert when only one listing', () => {
    expect(
      pickCollectionPsaCertNumber(
        [{ cert: '999', considerationAmount: '42' }],
        null,
      ),
    ).toBe('999');
  });
});

describe('normalizePsaCertDigits', () => {
  it('strips non-digits', () => {
    expect(normalizePsaCertDigits('71-203-344')).toBe('71203344');
  });
});
