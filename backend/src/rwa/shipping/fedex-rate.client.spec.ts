import { ConfigService } from '@nestjs/config';
import {
  FedExRateClient,
  FEDEX_KR_DOMESTIC_UNSUPPORTED_MESSAGE,
  assertFedExLaneSupported,
  pickCheapestRate,
} from './fedex-rate.client';

describe('assertFedExLaneSupported', () => {
  it('rejects Korea → Korea without quoting', () => {
    try {
      assertFedExLaneSupported('KR', 'KR');
      fail('expected throw');
    } catch (e) {
      const res = (e as { getResponse: () => unknown }).getResponse();
      expect(res).toEqual({
        code: 'FEDEX_RATE_UNSUPPORTED_LANE',
        category: 'unsupported_lane',
        message: FEDEX_KR_DOMESTIC_UNSUPPORTED_MESSAGE,
      });
    }
  });

  it('allows US → KR', () => {
    expect(() => assertFedExLaneSupported('US', 'KR')).not.toThrow();
  });
});

describe('pickCheapestRate', () => {
  it('picks cheapest service by price (no International Economy preference)', () => {
    const picked = pickCheapestRate({
      output: {
        rateReplyDetails: [
          {
            serviceType: 'FEDEX_INTERNATIONAL_PRIORITY',
            ratedShipmentDetails: [
              { rateType: 'ACCOUNT', totalNetCharge: 90 },
            ],
          },
          {
            serviceType: 'FEDEX_INTERNATIONAL_CONNECT_PLUS',
            ratedShipmentDetails: [
              { rateType: 'ACCOUNT', totalNetCharge: 40 },
            ],
          },
          {
            serviceType: 'INTERNATIONAL_ECONOMY',
            ratedShipmentDetails: [
              { rateType: 'ACCOUNT', totalNetCharge: 55 },
            ],
          },
        ],
      },
    });
    expect(picked?.serviceType).toBe('FEDEX_INTERNATIONAL_CONNECT_PLUS');
    expect(picked?.amount).toBe(40);
    expect(picked?.rateType).toBe('ACCOUNT');
  });

  it('prefers ACCOUNT over cheaper LIST when both present', () => {
    const picked = pickCheapestRate({
      output: {
        rateReplyDetails: [
          {
            serviceType: 'INTERNATIONAL_ECONOMY',
            ratedShipmentDetails: [
              { rateType: 'LIST', totalNetCharge: 30 },
              { rateType: 'ACCOUNT', totalNetCharge: 50 },
            ],
          },
          {
            serviceType: 'FEDEX_INTERNATIONAL_CONNECT_PLUS',
            ratedShipmentDetails: [{ rateType: 'LIST', totalNetCharge: 25 }],
          },
        ],
      },
    });
    expect(picked?.serviceType).toBe('INTERNATIONAL_ECONOMY');
    expect(picked?.amount).toBe(50);
    expect(picked?.rateType).toBe('ACCOUNT');
  });

  it('falls back to LIST when ACCOUNT is unavailable', () => {
    const picked = pickCheapestRate({
      output: {
        rateReplyDetails: [
          {
            serviceType: 'FEDEX_GROUND',
            ratedShipmentDetails: [
              { rateType: 'LIST', totalNetCharge: { amount: '12.34' } },
            ],
          },
          {
            serviceType: 'PRIORITY_OVERNIGHT',
            ratedShipmentDetails: [{ rateType: 'LIST', totalNetCharge: 45.2 }],
          },
        ],
      },
    });
    expect(picked?.serviceType).toBe('FEDEX_GROUND');
    expect(picked?.amount).toBe(12.34);
    expect(picked?.rateType).toBe('LIST');
  });

  it('picks cheaper Ground over Express when both ACCOUNT', () => {
    const picked = pickCheapestRate({
      output: {
        rateReplyDetails: [
          {
            serviceType: 'PRIORITY_OVERNIGHT',
            ratedShipmentDetails: [
              { rateType: 'ACCOUNT', totalNetCharge: 45.2 },
            ],
          },
          {
            serviceType: 'FEDEX_GROUND',
            ratedShipmentDetails: [
              {
                rateType: 'ACCOUNT',
                totalNetCharge: { amount: '12.34', currency: 'USD' },
              },
            ],
          },
        ],
      },
    });
    expect(picked?.serviceType).toBe('FEDEX_GROUND');
    expect(picked?.amount).toBe(12.34);
  });

  it('returns null when empty', () => {
    expect(pickCheapestRate({ output: { rateReplyDetails: [] } })).toBeNull();
  });
});

describe('FedExRateClient quote expiration', () => {
  it('stub quotes include expiresAt ~15 minutes ahead', async () => {
    const config = {
      get: (key: string) => {
        if (key === 'FEDEX_RATE_ENABLED') return 'false';
        if (key === 'FEDEX_RATE_QUOTE_TTL_MINUTES') return '15';
        return undefined;
      },
    } as ConfigService;
    const client = new FedExRateClient(config);
    const before = Date.now();
    const quote = await client.quote({
      origin: {
        country: 'US',
        city: 'LA',
        region: 'CA',
        postal: '90015',
        line1: '1 Main',
        residential: false,
      },
      destination: {
        country: 'US',
        city: 'SF',
        region: 'CA',
        postal: '94103',
        line1: '2 Market',
        residential: true,
      },
      destinationBucket: 'us',
      packageCount: 1,
    });
    const after = Date.now();
    expect(quote.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const exp = Date.parse(quote.expiresAt);
    expect(exp).toBeGreaterThanOrEqual(before + 14 * 60_000);
    expect(exp).toBeLessThanOrEqual(after + 16 * 60_000);
    expect(quote.source).toBe('fedex_stub');
  });

  it('honors FEDEX_RATE_QUOTE_TTL_MINUTES', async () => {
    const config = {
      get: (key: string) => {
        if (key === 'FEDEX_RATE_ENABLED') return 'false';
        if (key === 'FEDEX_RATE_QUOTE_TTL_MINUTES') return '5';
        return undefined;
      },
    } as ConfigService;
    const client = new FedExRateClient(config);
    const before = Date.now();
    const quote = await client.quote({
      origin: {
        country: 'US',
        city: 'LA',
        region: 'CA',
        postal: '90015',
        line1: '1 Main',
        residential: false,
      },
      destination: {
        country: 'KR',
        city: 'Seoul',
        region: null,
        postal: '07788',
        line1: '1 Road',
        residential: true,
      },
      destinationBucket: 'intl',
      packageCount: 2,
    });
    const exp = Date.parse(quote.expiresAt);
    expect(exp).toBeGreaterThanOrEqual(before + 4 * 60_000);
    expect(exp).toBeLessThanOrEqual(Date.now() + 6 * 60_000);
  });

  it('KR→KR quote fails with clear message (no stub price)', async () => {
    const config = {
      get: (key: string) => {
        if (key === 'FEDEX_RATE_ENABLED') return 'false';
        return undefined;
      },
    } as ConfigService;
    const client = new FedExRateClient(config);
    await expect(
      client.quote({
        origin: {
          country: 'KR',
          city: 'Seoul',
          region: null,
          postal: '07788',
          line1: '1 Road',
          residential: false,
        },
        destination: {
          country: 'KR',
          city: 'Seoul',
          region: null,
          postal: '06236',
          line1: '2 Road',
          residential: true,
        },
        destinationBucket: 'intl',
        packageCount: 1,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'FEDEX_RATE_UNSUPPORTED_LANE',
        message: FEDEX_KR_DOMESTIC_UNSUPPORTED_MESSAGE,
      },
    });
  });
});
