import { ConfigService } from '@nestjs/config';
import {
  parseGoogleAddressComponents,
  PlacesAddressService,
} from './places-address.service';

describe('parseGoogleAddressComponents', () => {
  it('maps a US street address', () => {
    const parsed = parseGoogleAddressComponents(
      [
        { longText: '350', shortText: '350', types: ['street_number'] },
        { longText: 'Fifth Avenue', shortText: '5th Ave', types: ['route'] },
        { longText: 'New York', shortText: 'New York', types: ['locality'] },
        {
          longText: 'New York',
          shortText: 'NY',
          types: ['administrative_area_level_1'],
        },
        { longText: '10118', shortText: '10118', types: ['postal_code'] },
        { longText: 'United States', shortText: 'US', types: ['country'] },
      ],
      '350 Fifth Avenue, New York, NY 10118, USA',
      'p2',
    );
    expect(parsed.line1).toBe('350 Fifth Avenue');
    expect(parsed.city).toBe('New York');
    expect(parsed.region).toBe('NY');
    expect(parsed.country).toBe('us');
    expect(parsed.phoneDial).toBe('+1');
    expect(parsed.blocked).toBe(false);
  });

  it('flags undeliverable Thailand', () => {
    const parsed = parseGoogleAddressComponents(
      [
        { longText: 'Bangkok', types: ['locality'] },
        { longText: 'Thailand', shortText: 'TH', types: ['country'] },
      ],
      'Bangkok, Thailand',
      'th1',
    );
    expect(parsed.blocked).toBe(true);
    expect(parsed.blockedName).toBe('Thailand');
    expect(parsed.country).toBe('intl');
    expect(parsed.phoneDial).toBe('+66');
  });
});

describe('PlacesAddressService mock (no API key)', () => {
  const svc = new PlacesAddressService({
    get: (key: string) => (key === 'NODE_ENV' ? 'development' : ''),
  } as ConfigService);

  it('is enabled in non-production without a key', () => {
    expect(svc.isEnabled()).toBe(true);
  });

  it('filters mock suggestions', async () => {
    const { suggestions } = await svc.suggest('fifth');
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.main).toContain('Fifth');
  });

  it('returns mock details', async () => {
    const row = await svc.details('p8');
    expect(row?.blocked).toBe(true);
    expect(row?.countryIso2).toBe('TH');
  });
});
