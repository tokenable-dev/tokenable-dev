import {
  buildPriceSubscriptionExternalId,
  normalizePriceWebhookUpdates,
  parsePriceSubscriptionExternalId,
} from './cardhedger-price-external-id.util';

describe('cardhedger-price-external-id.util', () => {
  it('round-trips collection keys via tokenable prefix', () => {
    const externalId = buildPriceSubscriptionExternalId('pikachu-base-58');
    expect(externalId).toBe('tokenable:pikachu-base-58');
    expect(parsePriceSubscriptionExternalId(externalId)).toBe('pikachu-base-58');
  });

  it('normalizes webhook bodies with updates array or single object', () => {
    const batch = normalizePriceWebhookUpdates({
      updates: [{ card_id: 'a', external_id: 'tokenable:key-1' }],
    });
    expect(batch).toHaveLength(1);

    const single = normalizePriceWebhookUpdates({
      card_id: 'b',
      external_id: 'tokenable:key-2',
    });
    expect(single).toHaveLength(1);
  });
});
