import {
  isFedExTrackableCarrier,
  parseFedExTrackResponse,
  parseFedExTrackResult,
} from './fedex-track.util';

describe('isFedExTrackableCarrier', () => {
  it('treats null/empty/fedex as trackable', () => {
    expect(isFedExTrackableCarrier(null)).toBe(true);
    expect(isFedExTrackableCarrier('')).toBe(true);
    expect(isFedExTrackableCarrier('FedEx')).toBe(true);
    expect(isFedExTrackableCarrier('fedex')).toBe(true);
  });

  it('rejects other carriers', () => {
    expect(isFedExTrackableCarrier('ups')).toBe(false);
    expect(isFedExTrackableCarrier('dhl')).toBe(false);
  });
});

describe('parseFedExTrackResult', () => {
  it('detects ACTUAL_DELIVERY date', () => {
    const r = parseFedExTrackResult('874592720570', {
      latestStatusDetail: { derivedCode: 'DL', description: 'Delivered' },
      dateAndTimes: [
        { type: 'SHIP', dateTime: '2026-07-21T05:28:00' },
        { type: 'ACTUAL_DELIVERY', dateTime: '2026-07-23T12:30:00' },
      ],
    });
    expect(r.delivered).toBe(true);
    expect(r.deliveredAt?.toISOString()).toContain('2026-07-23');
    expect(r.statusCode).toBe('DL');
  });

  it('detects DL without ACTUAL_DELIVERY', () => {
    const before = Date.now();
    const r = parseFedExTrackResult('123', {
      latestStatusDetail: { code: 'DL', statusByLocale: 'Delivered' },
      dateAndTimes: [],
    });
    expect(r.delivered).toBe(true);
    expect(r.deliveredAt).toBeTruthy();
    expect(r.deliveredAt!.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('is not delivered for in-transit', () => {
    const r = parseFedExTrackResult('123', {
      latestStatusDetail: { derivedCode: 'IT', description: 'In transit' },
      dateAndTimes: [{ type: 'ESTIMATED_DELIVERY', dateTime: '2026-07-24' }],
    });
    expect(r.delivered).toBe(false);
    expect(r.deliveredAt).toBeNull();
  });
});

describe('parseFedExTrackResponse', () => {
  it('flattens completeTrackResults', () => {
    const out = parseFedExTrackResponse({
      output: {
        completeTrackResults: [
          {
            trackingNumber: '874592720570',
            trackResults: [
              {
                latestStatusDetail: { derivedCode: 'DL' },
                dateAndTimes: [
                  { type: 'ACTUAL_DELIVERY', dateTime: '2026-07-23T12:30:00Z' },
                ],
              },
            ],
          },
        ],
      },
    });
    expect(out).toHaveLength(1);
    expect(out[0].trackingNumber).toBe('874592720570');
    expect(out[0].delivered).toBe(true);
  });
});
