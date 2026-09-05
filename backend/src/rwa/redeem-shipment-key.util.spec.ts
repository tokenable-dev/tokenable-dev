import {
  redeemShipToFingerprint,
  redeemTrackingGroupKey,
} from './redeem-shipment-key.util';

describe('redeemTrackingGroupKey', () => {
  const shipA = {
    name: 'Alex Buyer',
    line1: '1 Main St',
    line2: null,
    city: 'Austin',
    region: 'TX',
    postal: '78701',
    country: 'US',
  };

  it('separates same partner batch rows with different ship-to', () => {
    const batch = 'batch-1';
    const keyA = redeemTrackingGroupKey({
      paymentBatchId: batch,
      shipmentKey: 'partner:p1',
      shipTo: shipA,
    });
    const keyB = redeemTrackingGroupKey({
      paymentBatchId: batch,
      shipmentKey: 'partner:p1',
      shipTo: { ...shipA, city: 'Seoul', country: 'KR' },
    });
    expect(keyA).not.toBe(keyB);
    expect(redeemShipToFingerprint(shipA)).not.toBe(
      redeemShipToFingerprint({ ...shipA, city: 'Seoul', country: 'KR' }),
    );
  });

  it('separates different batches with same ship-to', () => {
    const keyA = redeemTrackingGroupKey({
      paymentBatchId: 'batch-old',
      shipmentKey: 'partner:p1',
      shipTo: shipA,
    });
    const keyB = redeemTrackingGroupKey({
      paymentBatchId: 'batch-new',
      shipmentKey: 'partner:p1',
      shipTo: shipA,
    });
    expect(keyA).not.toBe(keyB);
  });
});
