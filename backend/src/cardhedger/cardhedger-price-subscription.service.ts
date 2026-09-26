import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { readCardhedgerFeatureFlags } from '../config/cardhedger-feature-flags.util';
import { MarketplaceCollection } from '../marketplace/entities/marketplace-collection.entity';
import { CollectionMarketSnapshot } from '../marketplace/entities/collection-market-snapshot.entity';
import { marketHistoryTierFromComponents } from '../marketplace/utils/market-history-tier.util';
import { cardhedgerGradeFromHistoryTier } from '../marketplace/utils/psa-grade-policy.util';
import { CardhedgerService } from './cardhedger.service';
import { CardhedgerPriceSubscription } from './entities/cardhedger-price-subscription.entity';
import { buildPriceSubscriptionExternalId } from './utils/cardhedger-price-external-id.util';

const SUBSCRIBE_BATCH_MAX = 100;

export type SubscribeCollectionResult = {
  collectionKey: string;
  subscribed: boolean;
  skipped?: string;
  error?: string;
};

@Injectable()
export class CardhedgerPriceSubscriptionService {
  private readonly logger = new Logger(CardhedgerPriceSubscriptionService.name);

  constructor(
    private readonly cardhedger: CardhedgerService,
    private readonly config: ConfigService,
    @InjectRepository(CardhedgerPriceSubscription)
    private readonly subRepo: Repository<CardhedgerPriceSubscription>,
    @InjectRepository(MarketplaceCollection)
    private readonly collectionRepo: Repository<MarketplaceCollection>,
    @InjectRepository(CollectionMarketSnapshot)
    private readonly snapshotRepo: Repository<CollectionMarketSnapshot>,
  ) {}

  private flags() {
    return (
      this.config.get<ReturnType<typeof readCardhedgerFeatureFlags>>(
        'marketplace.cardhedgerFeatureFlags',
      ) ?? readCardhedgerFeatureFlags()
    );
  }

  private clientId(): string {
    const id = this.config.get<string>('CARDHEDGER_CLIENT_ID')?.trim();
    if (!id) {
      throw new ServiceUnavailableException(
        'CARDHEDGER_CLIENT_ID is required for subscribe-price-updates',
      );
    }
    return id;
  }

  isSubscribeEnabled(): boolean {
    return this.flags().priceSubscribeEnabled;
  }

  async subscribeCollection(
    collectionKey: string,
  ): Promise<SubscribeCollectionResult> {
    const key = collectionKey.trim().toLowerCase();
    if (!key) {
      return { collectionKey: key, subscribed: false, skipped: 'empty_key' };
    }
    if (!this.isSubscribeEnabled()) {
      return { collectionKey: key, subscribed: false, skipped: 'flag_off' };
    }

    const col = await this.collectionRepo.findOne({ where: { collectionKey: key } });
    if (!col) {
      return { collectionKey: key, subscribed: false, skipped: 'collection_not_found' };
    }

    const cardId = await this.resolveCardIdForCollection(col);
    if (!cardId) {
      return { collectionKey: key, subscribed: false, skipped: 'no_card_id' };
    }

    const grade = cardhedgerGradeFromHistoryTier(
      marketHistoryTierFromComponents(col.components),
    );
    const externalId = buildPriceSubscriptionExternalId(key);

    try {
      this.cardhedger.assertConfigured();
      const body = await this.cardhedger.forwardJson(
        'POST',
        '/v1/cards/subscribe-price-updates',
        {
          body: {
            client_id: this.clientId(),
            subscriptions: [{ card_id: cardId, grade, external_id: externalId }],
          },
        },
      );
      const results = Array.isArray((body as { results?: unknown[] })?.results)
        ? ((body as { results: unknown[] }).results ?? [])
        : [];
      const row = results[0] as { success?: boolean; error?: string } | undefined;
      const success = row?.success === true;

      let entity = await this.subRepo.findOne({ where: { collectionKey: key } });
      if (!entity) {
        entity = this.subRepo.create({
          collectionKey: key,
          cardId,
          grade,
          externalId,
        });
      }
      entity.cardId = cardId;
      entity.grade = grade;
      entity.externalId = externalId;
      entity.active = success;
      entity.upstreamSuccess = success;
      entity.upstreamError = success
        ? null
        : String(row?.error ?? 'subscribe failed').slice(0, 500);
      entity.deactivatedAt = success ? null : new Date();
      await this.subRepo.save(entity);

      if (!success) {
        return {
          collectionKey: key,
          subscribed: false,
          error: row?.error ?? 'upstream rejected',
        };
      }

      this.logger.log(
        JSON.stringify({
          msg: 'cardhedger_price_subscribe',
          collectionKey: key,
          cardId,
          grade,
        }),
      );
      return { collectionKey: key, subscribed: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(
        `subscribe-price-updates failed key=${key}: ${msg}`,
      );
      return { collectionKey: key, subscribed: false, error: msg };
    }
  }

  async unsubscribeCollection(collectionKey: string): Promise<{ ok: true }> {
    const key = collectionKey.trim().toLowerCase();
    const externalId = buildPriceSubscriptionExternalId(key);
    await this.subRepo.update(
      { externalId },
      { active: false, deactivatedAt: new Date() },
    );
    return { ok: true };
  }

  async listSubscriptions(options?: {
    limit?: number;
    offset?: number;
    activeOnly?: boolean;
  }): Promise<{
    items: Array<{
      collectionKey: string;
      cardId: string;
      grade: string;
      externalId: string;
      active: boolean;
      upstreamSuccess: boolean | null;
      upstreamError: string | null;
      subscribedAt: string;
      lastWebhookAt: string | null;
      deactivatedAt: string | null;
    }>;
    total: number;
  }> {
    const limit = Math.min(500, Math.max(1, Math.floor(options?.limit ?? 100)));
    const offset = Math.max(0, Math.floor(options?.offset ?? 0));
    const activeOnly = options?.activeOnly === true;

    const qb = this.subRepo
      .createQueryBuilder('s')
      .orderBy('s.subscribed_at', 'DESC')
      .take(limit)
      .skip(offset);

    if (activeOnly) {
      qb.andWhere('s.active = TRUE');
    }

    const [rows, total] = await qb.getManyAndCount();
    return {
      total,
      items: rows.map((row) => ({
        collectionKey: row.collectionKey,
        cardId: row.cardId,
        grade: row.grade,
        externalId: row.externalId,
        active: row.active,
        upstreamSuccess: row.upstreamSuccess,
        upstreamError: row.upstreamError,
        subscribedAt: row.subscribedAt.toISOString(),
        lastWebhookAt: row.lastWebhookAt?.toISOString() ?? null,
        deactivatedAt: row.deactivatedAt?.toISOString() ?? null,
      })),
    };
  }

  async countActiveSubscriptions(): Promise<number> {
    return this.subRepo.count({ where: { active: true } });
  }

  /** All collection keys with a Cardhedger card id (snapshot or components). */
  async listCatalogCollectionKeys(limit = 2000): Promise<string[]> {
    return this.collectSubscriptionCandidateKeys(limit);
  }

  async loadCatalogCardIdIndex(): Promise<Map<string, string[]>> {
    const snapRows = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('LOWER(s.cardhedger_card_id)', 'cardId')
      .addSelect('s.collection_key', 'collectionKey')
      .where('s.cardhedger_card_id IS NOT NULL')
      .andWhere("TRIM(s.cardhedger_card_id) <> ''")
      .getRawMany<{ cardId: string; collectionKey: string }>();

    const compRows = await this.collectionRepo
      .createQueryBuilder('c')
      .select("LOWER(c.components->>'cardhedgerCardId')", 'cardId')
      .addSelect('c.collection_key', 'collectionKey')
      .where("c.components->>'cardhedgerCardId' IS NOT NULL")
      .andWhere("TRIM(c.components->>'cardhedgerCardId') <> ''")
      .getRawMany<{ cardId: string; collectionKey: string }>();

    const index = new Map<string, string[]>();
    const add = (cardId: string, collectionKey: string) => {
      const id = cardId.trim().toLowerCase();
      const key = collectionKey.trim().toLowerCase();
      if (!id || !key) return;
      const list = index.get(id) ?? [];
      if (!list.includes(key)) list.push(key);
      index.set(id, list);
    };
    for (const r of snapRows) add(r.cardId, r.collectionKey);
    for (const r of compRows) add(r.cardId, r.collectionKey);
    return index;
  }

  /** Sync active listings — collections with cardhedger id on snapshot or components. */
  async syncActiveSubscriptions(limit = 500): Promise<{
    attempted: number;
    subscribed: number;
    skipped: number;
    errors: number;
  }> {
    if (!this.isSubscribeEnabled()) {
      return { attempted: 0, subscribed: 0, skipped: 0, errors: 0 };
    }

    const keys = await this.collectSubscriptionCandidateKeys(limit);
    let subscribed = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < keys.length; i += SUBSCRIBE_BATCH_MAX) {
      const chunk = keys.slice(i, i + SUBSCRIBE_BATCH_MAX);
      const results = await Promise.all(
        chunk.map((k) => this.subscribeCollection(k)),
      );
      for (const r of results) {
        if (r.subscribed) subscribed++;
        else if (r.error) errors++;
        else skipped++;
      }
    }

    return { attempted: keys.length, subscribed, skipped, errors };
  }

  async findCollectionKeysByCardId(cardId: string): Promise<string[]> {
    const id = cardId.trim();
    if (!id) return [];

    const fromSubs = await this.subRepo.find({
      where: { cardId: id, active: true },
      select: ['collectionKey'],
    });
    const fromSnap = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('DISTINCT s.collection_key', 'collectionKey')
      .where('LOWER(s.cardhedger_card_id) = LOWER(:id)', { id })
      .getRawMany<{ collectionKey: string }>();

    const fromComponents = await this.collectionRepo
      .createQueryBuilder('c')
      .select('c.collection_key', 'collectionKey')
      .where("LOWER(c.components->>'cardhedgerCardId') = LOWER(:id)", { id })
      .getRawMany<{ collectionKey: string }>();

    const keys = new Set<string>();
    for (const r of fromSubs) keys.add(r.collectionKey.toLowerCase());
    for (const r of fromSnap) {
      if (r.collectionKey) keys.add(String(r.collectionKey).toLowerCase());
    }
    for (const r of fromComponents) {
      if (r.collectionKey) keys.add(String(r.collectionKey).toLowerCase());
    }
    return [...keys];
  }

  /** Batch map card_id → collection keys (snapshots, components, optional subscriptions). */
  async mapCollectionKeysByCardIds(cardIds: string[]): Promise<Map<string, string[]>> {
    const ids = [
      ...new Set(cardIds.map((x) => x.trim()).filter((x) => x.length > 0)),
    ];
    const norm = (x: string) => x.trim().toLowerCase();
    const result = new Map<string, string[]>();
    for (const id of ids) result.set(norm(id), []);

    if (ids.length === 0) return result;

    const fromSubs = await this.subRepo
      .createQueryBuilder('s')
      .select(['s.card_id AS "cardId"', 's.collection_key AS "collectionKey"'])
      .where('s.active = TRUE')
      .andWhere('LOWER(s.card_id) IN (:...ids)', {
        ids: ids.map((x) => x.toLowerCase()),
      })
      .getRawMany<{ cardId: string; collectionKey: string }>();

    const fromSnap = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('LOWER(s.cardhedger_card_id)', 'cardId')
      .addSelect('s.collection_key', 'collectionKey')
      .where('s.cardhedger_card_id IS NOT NULL')
      .andWhere("TRIM(s.cardhedger_card_id) <> ''")
      .andWhere('LOWER(s.cardhedger_card_id) IN (:...ids)', {
        ids: ids.map((x) => x.toLowerCase()),
      })
      .getRawMany<{ cardId: string; collectionKey: string }>();

    const fromComponents = await this.collectionRepo
      .createQueryBuilder('c')
      .select("LOWER(c.components->>'cardhedgerCardId')", 'cardId')
      .addSelect('c.collection_key', 'collectionKey')
      .where("c.components->>'cardhedgerCardId' IS NOT NULL")
      .andWhere("TRIM(c.components->>'cardhedgerCardId') <> ''")
      .andWhere("LOWER(c.components->>'cardhedgerCardId') IN (:...ids)", {
        ids: ids.map((x) => x.toLowerCase()),
      })
      .getRawMany<{ cardId: string; collectionKey: string }>();

    const add = (cardId: string, collectionKey: string) => {
      const id = cardId.trim().toLowerCase();
      const key = collectionKey.trim().toLowerCase();
      if (!id || !key) return;
      const list = result.get(id) ?? [];
      if (!list.includes(key)) list.push(key);
      result.set(id, list);
    };

    for (const r of fromSubs) add(r.cardId, r.collectionKey);
    for (const r of fromSnap) add(r.cardId, r.collectionKey);
    for (const r of fromComponents) add(r.cardId, r.collectionKey);

    return result;
  }

  async touchWebhookForExternalIds(externalIds: string[]): Promise<void> {
    const ids = [
      ...new Set(
        externalIds.map((x) => String(x ?? '').trim()).filter((x) => x.length > 0),
      ),
    ];
    if (ids.length === 0) return;
    await this.subRepo.update(
      { externalId: In(ids), active: true },
      { lastWebhookAt: new Date() },
    );
  }

  private async collectSubscriptionCandidateKeys(limit: number): Promise<string[]> {
    const snapRows = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('DISTINCT s.collection_key', 'collectionKey')
      .where('s.cardhedger_card_id IS NOT NULL')
      .andWhere("TRIM(s.cardhedger_card_id) <> ''")
      .orderBy('s.collection_key', 'ASC')
      .limit(limit)
      .getRawMany<{ collectionKey: string }>();

    return snapRows
      .map((r) => String(r.collectionKey ?? '').trim().toLowerCase())
      .filter(Boolean);
  }

  private async resolveCardIdForCollection(
    col: MarketplaceCollection,
  ): Promise<string | null> {
    const fromComp = String(col.components?.cardhedgerCardId ?? '').trim();
    if (fromComp) return fromComp;

    const snap = await this.snapshotRepo.findOne({
      where: { collectionKey: col.collectionKey },
      select: ['cardhedgerCardId'],
    });
    const fromSnap = String(snap?.cardhedgerCardId ?? '').trim();
    return fromSnap || null;
  }
}
