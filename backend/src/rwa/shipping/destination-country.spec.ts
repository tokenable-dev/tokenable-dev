import { resolveShipToDestinationIso2, requireIso2CountryCode } from './destination-country';

describe('destination-country', () => {
  describe('requireIso2CountryCode', () => {
    it('normalizes valid ISO-2', () => {
      expect(requireIso2CountryCode('kr', 'dest')).toBe('KR');
      expect(requireIso2CountryCode('US', 'dest')).toBe('US');
    });

    it('rejects missing, XX, and non-ISO', () => {
      expect(() => requireIso2CountryCode('', 'dest')).toThrow(/ISO-3166/);
      expect(() => requireIso2CountryCode(null, 'dest')).toThrow(/ISO-3166/);
      expect(() => requireIso2CountryCode('XX', 'dest')).toThrow(/ISO-3166/);
      expect(() => requireIso2CountryCode('USA', 'dest')).toThrow(/ISO-3166/);
      expect(() => requireIso2CountryCode('intl', 'dest')).toThrow(/ISO-3166/);
    });
  });

  describe('resolveShipToDestinationIso2', () => {
    it('prefers countryCode over bucket', () => {
      expect(
        resolveShipToDestinationIso2({ country: 'us', countryCode: 'kr' }),
      ).toBe('KR');
    });

    it('maps us/ca buckets when countryCode omitted', () => {
      expect(resolveShipToDestinationIso2({ country: 'us' })).toBe('US');
      expect(resolveShipToDestinationIso2({ country: 'ca' })).toBe('CA');
    });

    it('fails intl without countryCode (no phone / XX guess)', () => {
      expect(() =>
        resolveShipToDestinationIso2({ country: 'intl' }),
      ).toThrow(/countryCode/);
    });

    it('accepts ISO-2 placed on country when not a bucket', () => {
      expect(resolveShipToDestinationIso2({ country: 'JP' })).toBe('JP');
    });
  });
});
