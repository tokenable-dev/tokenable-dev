import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { readCardhedgerFeatureFlags } from '../config/cardhedger-feature-flags.util';
import { CardhedgerPriceWebhookService } from './cardhedger-price-webhook.service';
import { CardhedgerPriceSubscriptionService } from './cardhedger-price-subscription.service';

describe('CardhedgerPriceWebhookService', () => {
  const flags = {
    priceWebhookEnabled: true,
    priceSubscribeEnabled: false,
    dailyPriceDeltaImportEnabled: false,
    dailyPriceExportCsvEnabled: false,
  };

  function serviceWith(
    subscriptions: Partial<CardhedgerPriceSubscriptionService>,
  ): CardhedgerPriceWebhookService {
    const config = {
      get: (key: string) => {
        if (key === 'marketplace.cardhedgerFeatureFlags') return flags;
        if (key === 'CARDHEDGER_WEBHOOK_SECRET') return 'test-secret';
        return undefined;
      },
    };
    const emitter = { emit: jest.fn() } as unknown as EventEmitter2;
    const svc = new CardhedgerPriceWebhookService(
      config as never,
      {
        findCollectionKeysByCardId: jest.fn(async () => []),
        touchWebhookForExternalIds: jest.fn(async () => undefined),
        ...subscriptions,
      } as unknown as CardhedgerPriceSubscriptionService,
      emitter,
    );
    return svc;
  }

  it('rejects when webhook flag is off', () => {
    const svc = serviceWith({});
    flags.priceWebhookEnabled = false;
    expect(() =>
      svc.assertAuthorized({ 'x-cardhedger-webhook-secret': 'test-secret' }),
    ).toThrow(ForbiddenException);
    flags.priceWebhookEnabled = true;
  });

  it('stays disabled under default feature flags (empty env)', () => {
    const defaultFlags = readCardhedgerFeatureFlags({});
    const config = {
      get: (key: string) => {
        if (key === 'marketplace.cardhedgerFeatureFlags') return defaultFlags;
        if (key === 'CARDHEDGER_WEBHOOK_SECRET') return 'test-secret';
        return undefined;
      },
    };
    const svc = new CardhedgerPriceWebhookService(
      config as never,
      {
        findCollectionKeysByCardId: jest.fn(async () => []),
        touchWebhookForExternalIds: jest.fn(async () => undefined),
      } as unknown as CardhedgerPriceSubscriptionService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );
    expect(defaultFlags.priceWebhookEnabled).toBe(false);
    expect(() =>
      svc.assertAuthorized({ 'x-cardhedger-webhook-secret': 'test-secret' }),
    ).toThrow(ForbiddenException);
  });

  it('enqueues snapshot refresh for external_id mapping', async () => {
    const emitter = { emit: jest.fn() };
    const config = {
      get: (key: string) => {
        if (key === 'marketplace.cardhedgerFeatureFlags') return flags;
        if (key === 'CARDHEDGER_WEBHOOK_SECRET') return 'test-secret';
        return undefined;
      },
    };
    const svc = new CardhedgerPriceWebhookService(
      config as never,
      {
        findCollectionKeysByCardId: jest.fn(async () => ['from-card-id']),
        touchWebhookForExternalIds: jest.fn(async () => undefined),
      } as unknown as CardhedgerPriceSubscriptionService,
      emitter as unknown as EventEmitter2,
    );

    const result = await svc.handlePayload({
      updates: [
        {
          card_id: 'abc',
          external_id: 'tokenable:my-collection',
          update_timestamp: '2024-01-01T00:00:01.000Z',
        },
      ],
    });

    expect(result.enqueued).toBe(2);
    expect(emitter.emit).toHaveBeenCalledWith('snapshot.enqueue', {
      key: 'my-collection',
      reason: 'price_webhook',
    });
    expect(emitter.emit).toHaveBeenCalledWith('snapshot.enqueue', {
      key: 'from-card-id',
      reason: 'price_webhook',
    });
  });
});
