import {
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { readCardhedgerFeatureFlags } from '../config/cardhedger-feature-flags.util';
import { CardhedgerPriceSubscriptionService } from './cardhedger-price-subscription.service';
import {
  normalizePriceWebhookUpdates,
  parsePriceSubscriptionExternalId,
} from './utils/cardhedger-price-external-id.util';

@Injectable()
export class CardhedgerPriceWebhookService {
  private readonly logger = new Logger(CardhedgerPriceWebhookService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly subscriptions: CardhedgerPriceSubscriptionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private flags() {
    return (
      this.config.get<ReturnType<typeof readCardhedgerFeatureFlags>>(
        'marketplace.cardhedgerFeatureFlags',
      ) ?? readCardhedgerFeatureFlags()
    );
  }

  assertAuthorized(headers: Record<string, unknown>): void {
    if (!this.flags().priceWebhookEnabled) {
      throw new ForbiddenException('Cardhedger price webhook is disabled');
    }
    const expected = this.config.get<string>('CARDHEDGER_WEBHOOK_SECRET')?.trim();
    if (!expected) {
      throw new ForbiddenException('CARDHEDGER_WEBHOOK_SECRET is not configured');
    }
    const headerSecret =
      String(headers['x-cardhedger-webhook-secret'] ?? '').trim() ||
      String(headers['x-webhook-secret'] ?? '').trim();
    const auth = String(headers['authorization'] ?? '').trim();
    const bearer = auth.toLowerCase().startsWith('bearer ')
      ? auth.slice(7).trim()
      : '';
    const provided = headerSecret || bearer;
    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
  }

  async handlePayload(body: unknown): Promise<{
    ok: true;
    updates: number;
    enqueued: number;
  }> {
    const updates = normalizePriceWebhookUpdates(body);
    const collectionKeys = new Set<string>();
    const externalIds: string[] = [];

    for (const u of updates) {
      if (u.external_id) {
        externalIds.push(String(u.external_id));
        const key = parsePriceSubscriptionExternalId(u.external_id);
        if (key) collectionKeys.add(key);
      }
      const cardId = String(u.card_id ?? '').trim();
      if (cardId) {
        const keys = await this.subscriptions.findCollectionKeysByCardId(cardId);
        for (const k of keys) collectionKeys.add(k);
      }
    }

    for (const key of collectionKeys) {
      this.eventEmitter.emit('snapshot.enqueue', {
        key,
        reason: 'price_webhook',
      });
    }

    if (externalIds.length > 0) {
      await this.subscriptions.touchWebhookForExternalIds(externalIds);
    }

    this.logger.log(
      JSON.stringify({
        msg: 'cardhedger_price_webhook',
        updates: updates.length,
        enqueued: collectionKeys.size,
      }),
    );

    return { ok: true, updates: updates.length, enqueued: collectionKeys.size };
  }
}
