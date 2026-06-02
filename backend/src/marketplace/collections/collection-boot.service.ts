import { Inject, Injectable, Logger, OnModuleInit, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { BUCKET_KEY_VERSION } from '../utils/bucket-key.util';
import { Order, OrderSide, OrderStatus } from '../entities/order.entity';
import { CollectionComponentsService } from './collection-components.service';
import { CollectionService } from './collection.service';
import { RwaTokenRegistryService } from './rwa-token-registry.service';

/** Deferred marketplace boot maintenance (bucket migrate, diagnostics, registry sync). */
@Injectable()
export class CollectionBootService implements OnModuleInit {
  private readonly logger = new Logger(CollectionBootService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly components: CollectionComponentsService,
    private readonly rwaTokenRegistry: RwaTokenRegistryService,
    @Inject(forwardRef(() => CollectionService))
    private readonly collections: CollectionService,
  ) {}

  onModuleInit(): void {
    setImmediate(() => {
      void this.runDeferredBootTasks();
    });
  }

  private async runDeferredBootTasks(): Promise<void> {
    const v = this.config.get<string>('MARKETPLACE_PIPELINE_DIAG');
    if (v === '1' || v === 'true') {
      try {
        await this.logNullCollectionKeyActiveAskSummary();
      } catch (e) {
        this.logger.error(
          `MARKETPLACE_PIPELINE_DIAG boot audit failed: ${String(e)}`,
        );
      }
    }

    const chAudit = this.config.get<string>(
      'CARDHEDGER_COLLECTION_AUDIT_ON_BOOT',
    );
    if (chAudit === '1' || chAudit === 'true') {
      try {
        await this.components.auditStaleCardhedgerCardIdsOnBoot();
      } catch (e) {
        this.logger.error(
          `CARDHEDGER_COLLECTION_AUDIT_ON_BOOT failed: ${String(e)}`,
        );
      }
    }

    const bucketMigrate = this.config.get<string>(
      'MARKETPLACE_BUCKET_KEY_MIGRATE_ON_BOOT',
    );
    if (bucketMigrate === '1' || bucketMigrate === 'true') {
      try {
        const r = await this.migrateActiveAskBucketKeysToCurrentVersion();
        this.logger.log(
          `MARKETPLACE_BUCKET_KEY_MIGRATE_ON_BOOT v${BUCKET_KEY_VERSION}: ${JSON.stringify(r)}`,
        );
      } catch (e) {
        this.logger.error(
          `MARKETPLACE_BUCKET_KEY_MIGRATE_ON_BOOT failed: ${String(e)}`,
        );
      }
    }

    const rwaSync = this.config.get<string>('RWA_TOKEN_REGISTRY_SYNC_ON_BOOT');
    if (rwaSync === '1' || rwaSync === 'true') {
      try {
        const r = await this.rwaTokenRegistry.syncAllMintedFromChain();
        this.logger.log(`RWA_TOKEN_REGISTRY_SYNC_ON_BOOT: ${JSON.stringify(r)}`);
      } catch (e) {
        this.logger.error(
          `RWA_TOKEN_REGISTRY_SYNC_ON_BOOT failed: ${String(e)}`,
        );
      }
    }
  }

  /**
   * Recompute collection_key from IPFS metadata (bucket v2: card # + parallel).
   * Updates active asks when the key changes; creates collection rows via ensureCollectionForListing.
   */
  async migrateActiveAskBucketKeysToCurrentVersion(): Promise<{
    scanned: number;
    updated: number;
    skipped: number;
  }> {
    const orders = await this.orderRepo.find({
      where: { status: OrderStatus.ACTIVE, side: OrderSide.ASK },
      select: ['orderHash', 'tokenId', 'collectionKey'],
    });
    let updated = 0;
    let skipped = 0;
    for (const order of orders) {
      const tid = String(order.tokenId ?? '').trim();
      if (!tid) {
        skipped++;
        continue;
      }
      try {
        const newKey = await this.collections.ensureCollectionForListing(tid);
        if (!newKey) {
          skipped++;
          continue;
        }
        const old = String(order.collectionKey ?? '')
          .trim()
          .toLowerCase();
        if (old === newKey.toLowerCase()) continue;
        await this.orderRepo.update(
          { orderHash: order.orderHash },
          { collectionKey: newKey },
        );
        updated++;
      } catch (e) {
        skipped++;
        this.logger.warn(
          `bucket key migrate skipped token=${tid}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    return { scanned: orders.length, updated, skipped };
  }
  private async logNullCollectionKeyActiveAskSummary(): Promise<void> {
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.token_id', 'tokenId')
      .addSelect('COUNT(*)::int', 'cnt')
      .where('o.collection_key IS NULL')
      .andWhere("o.side = 'ask'")
      .andWhere("o.status = 'active'")
      .groupBy('o.token_id')
      .orderBy('cnt', 'DESC')
      .limit(50)
      .getRawMany<{ tokenId: string; cnt: number }>();

    const totalNullKeyActiveAsks = await this.orderRepo.count({
      where: {
        side: OrderSide.ASK,
        status: OrderStatus.ACTIVE,
        collectionKey: IsNull(),
      },
    });
    const totalActiveAsks = await this.orderRepo.count({
      where: { side: OrderSide.ASK, status: OrderStatus.ACTIVE },
    });

    this.logger.warn(
      JSON.stringify({
        msg: 'collection_key_pipeline',
        step: 'db_audit_on_boot',
        totalActiveAsks,
        totalActiveAskRowsWithNullCollectionKey: totalNullKeyActiveAsks,
        topTokenIdsGroupedByNullKeyActiveAskCount: rows.map((r) => ({
          tokenId: r.tokenId,
          cnt: Number(r.cnt),
        })),
        note: 'Compare with UI meta-hash: if orders are null-key but UI computes a 64-char key, GET …/stats will return an empty pool for that key.',
      }),
    );
  }
}
