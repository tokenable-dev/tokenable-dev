import { ConfigService } from '@nestjs/config';
import {
  FEDEX_TRACK_PATHS,
  FedExTrackClient,
} from './fedex-track.client';
import {
  requireFedExOAuthCreds,
  resetFedExOAuthCacheForTests,
} from './fedex-api.util';

describe('FEDEX_TRACK_PATHS', () => {
  it('lists all six Track v1 endpoints from openapi spec', () => {
    expect(Object.keys(FEDEX_TRACK_PATHS)).toEqual([
      'trackingNumbers',
      'associatedShipments',
      'notifications',
      'referenceNumbers',
      'tcn',
      'trackingDocuments',
    ]);
    expect(FEDEX_TRACK_PATHS.trackingNumbers).toBe(
      '/track/v1/trackingnumbers',
    );
  });
});

describe('requireFedExOAuthCreds', () => {
  it('uses FEDEX_TRACK_CLIENT_* for track when set', () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'FEDEX_CLIENT_ID') return 'rate-id';
        if (key === 'FEDEX_CLIENT_SECRET') return 'rate-secret';
        if (key === 'FEDEX_TRACK_CLIENT_ID') return 'track-id';
        if (key === 'FEDEX_TRACK_CLIENT_SECRET') return 'track-secret';
        return '';
      }),
    } as unknown as ConfigService;
    expect(requireFedExOAuthCreds(config, 'rate')).toEqual({
      clientId: 'rate-id',
      clientSecret: 'rate-secret',
    });
    expect(requireFedExOAuthCreds(config, 'track')).toEqual({
      clientId: 'track-id',
      clientSecret: 'track-secret',
    });
  });

  it('falls back to shared FEDEX_CLIENT_* when track keys are empty', () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'FEDEX_CLIENT_ID') return 'rate-id';
        if (key === 'FEDEX_CLIENT_SECRET') return 'rate-secret';
        return '';
      }),
    } as unknown as ConfigService;
    expect(requireFedExOAuthCreds(config, 'track')).toEqual({
      clientId: 'rate-id',
      clientSecret: 'rate-secret',
    });
  });
});

describe('FedExTrackClient.probe', () => {
  beforeEach(() => {
    resetFedExOAuthCacheForTests();
    jest.restoreAllMocks();
  });

  it('returns config error when creds missing', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'FEDEX_TRACK_ENABLED') return 'true';
        return '';
      }),
    } as unknown as ConfigService;
    const client = new FedExTrackClient(config);
    const out = await client.probe('trackingNumbers', {
      includeDetailedScans: false,
      trackingInfo: [],
    });
    expect(out.oauth.ok).toBe(false);
    expect(out.fedexHttpStatus).toBeNull();
    expect(out.note).toMatch(/FEDEX_TRACK_CLIENT_ID|FEDEX_CLIENT_ID/);
  });

  it('returns disabled note when FEDEX_TRACK_ENABLED is off', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'FEDEX_TRACK_ENABLED') return 'false';
        if (key === 'FEDEX_CLIENT_ID') return 'test-client-id';
        if (key === 'FEDEX_CLIENT_SECRET') return 'test-secret';
        if (key === 'FEDEX_API_BASE_URL') return 'https://apis-sandbox.fedex.com';
        return '';
      }),
    } as unknown as ConfigService;
    const client = new FedExTrackClient(config);
    const out = await client.probe('tcn', { tcnInfo: { value: 'X' } });
    expect(out.oauth.error).toMatch(/FEDEX_TRACK_ENABLED/);
  });
});
