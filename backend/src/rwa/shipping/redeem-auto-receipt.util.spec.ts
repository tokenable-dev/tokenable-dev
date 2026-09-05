import {
  batchReadyForAutoReceipt,
  resolveRedeemAutoReceiptGraceMs,
  REDEEM_AUTO_RECEIPT_GRACE_DAYS_DEFAULT,
} from './redeem-auto-receipt.util';

describe('resolveRedeemAutoReceiptGraceMs', () => {
  it('prefers seconds when set', () => {
    expect(
      resolveRedeemAutoReceiptGraceMs({
        graceSecondsRaw: '300',
        graceDaysRaw: '3',
      }),
    ).toBe(300_000);
  });

  it('falls back to days', () => {
    expect(
      resolveRedeemAutoReceiptGraceMs({
        graceSecondsRaw: undefined,
        graceDaysRaw: '3',
      }),
    ).toBe(3 * 24 * 60 * 60 * 1000);
  });
});

describe('batchReadyForAutoReceipt', () => {
  const delivered = new Date('2026-07-23T12:30:00Z');

  it('ok after grace', () => {
    const r = batchReadyForAutoReceipt({
      rows: [
        {
          status: 'in_custody',
          refundStatus: 'none',
          trackingNumber: '874592720570',
          trackingCarrier: 'fedex',
          carrierDeliveredAt: delivered,
        },
      ],
      graceMs: REDEEM_AUTO_RECEIPT_GRACE_DAYS_DEFAULT * 24 * 60 * 60 * 1000,
      now: new Date('2026-07-27T12:30:00Z'),
    });
    expect(r).toEqual({ ok: true });
  });

  it('waits for grace', () => {
    const r = batchReadyForAutoReceipt({
      rows: [
        {
          status: 'in_custody',
          refundStatus: 'none',
          trackingNumber: '874592720570',
          trackingCarrier: 'fedex',
          carrierDeliveredAt: delivered,
        },
      ],
      graceMs: 3 * 24 * 60 * 60 * 1000,
      now: new Date('2026-07-24T12:30:00Z'),
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('grace_pending');
  });

  it('ok after 5 minute grace (test env)', () => {
    const deliveredAt = new Date('2026-07-23T12:30:00Z');
    const r = batchReadyForAutoReceipt({
      rows: [
        {
          status: 'in_custody',
          refundStatus: 'none',
          trackingNumber: '874592720570',
          trackingCarrier: 'fedex',
          carrierDeliveredAt: deliveredAt,
        },
      ],
      graceMs: 5 * 60 * 1000,
      now: new Date(deliveredAt.getTime() + 5 * 60 * 1000 + 1000),
    });
    expect(r).toEqual({ ok: true });
  });

  it('skips UPS batches', () => {
    const r = batchReadyForAutoReceipt({
      rows: [
        {
          status: 'in_custody',
          refundStatus: 'none',
          trackingNumber: '1Z...',
          trackingCarrier: 'ups',
          carrierDeliveredAt: delivered,
        },
      ],
      graceMs: 3 * 24 * 60 * 60 * 1000,
      now: new Date('2026-08-01T00:00:00Z'),
    });
    expect(r.reason).toBe('non_fedex');
  });
});
