import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  IsNull,
  QueryDeepPartialEntity,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { IpfsGatewayResolverService } from '../../blockchain/ipfs-gateway-resolver.service';
import { CardhedgerService } from '../../cardhedger/cardhedger.service';
import { specIdStringFromPsaCertBody } from '../../psa/psa-public-api.service';
import { PsaSpecScraperService } from '../../psa/psa-spec-scraper.service';
import {
  BUCKET_KEY_VERSION,
  computeMarketBucketKey,
  extractBucketComponentsFromMetadata,
  extractOrDiagnoseBucketComponents,
  metaShapeSampleForBucketLog,
} from '../utils/bucket-key.util';
import { marketParallelKeyFromPsaVariety } from '../utils/market-parallel-key.util';
import { mergePsaVarietyWithMintVariant } from '../../psa/psa-variety-catalog.util';
import {
  buildCollectionDisplayLabel,
  extractCollectionQueryUsed,
} from '../utils/collection-label.util';
import {
  extractCollectionRepresentativeImage,
  normalizeImageUrl,
  pickTrendingSlabImageRef,
  psaCertNumberFromGradedMeta,
} from '../utils/collection-image.util';
import {
  enrichCollectionComponentsForApi,
  psaCertNumberFromCollectionRow,
} from '../utils/collection-row.util';
import {
  componentsPsaMirrorSufficientForCardhedger,
  mergePsaCertSnapshotIntoMirror,
} from '../utils/psa-components-mirror.util';
import { CollectionMarketSnapshot } from '../entities/collection-market-snapshot.entity';
import { Order, OrderSide, OrderStatus } from '../entities/order.entity';
import { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import { RwaToken } from '../entities/rwa-token.entity';
import { exactCatalogMatch } from '../utils/card-match.util';
import { PsaCertSnapshotService } from './psa-cert-snapshot.service';
import { RwaTokenRegistryService } from './rwa-token-registry.service';
export interface CollectionSummary {
  collectionKey: string;
  displayLabel: string;
  queryUsed: string | null;
  components: Record<string, unknown>;
  createdAt: Date;
  activeListingCount: number;
  /** IPFS 메타에서 추출한 대표 커버 URL */
  coverImageUrl: string | null;
}

@Injectable()
export class CollectionService implements OnModuleInit {
  private readonly logger = new Logger(CollectionService.name);

  /**
   * Merkle leaf scans are expensive (IPFS × minted count). Cache by collection + totalMinted so
   * new mints naturally miss; listings of existing tokens stay valid without cache bust.
   */
  private readonly merkleSetCache = new Map<
    string,
    { tokenIds: string[]; expiresAtMs: number }
  >();
  private static readonly MERKLE_SET_CACHE_TTL_MS = 45_000;
  /** Lower parallelism reduces Pinata/IPFS flakes that change the Merkle leaf set between requests. */
  private static readonly MERKLE_SCAN_CONCURRENCY = 4;
  private static readonly MERKLE_TOKEN_LOOKUP_ATTEMPTS = 3;

  /** One in-flight resolve per collection — avoids duplicate Playwright runs on parallel requests. */
  private readonly representativeImageResolveInflight = new Map<
    string,
    Promise<string | null>
  >();

  constructor(
    @InjectRepository(MarketplaceCollection)
    private readonly collectionRepo: Repository<MarketplaceCollection>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly blockchain: BlockchainService,
    private readonly config: ConfigService,
    private readonly cardhedger: CardhedgerService,
    private readonly ipfsResolver: IpfsGatewayResolverService,
    private readonly psaSpecScraper: PsaSpecScraperService,
    private readonly psaCertSnapshots: PsaCertSnapshotService,
    private readonly rwaTokenRegistry: RwaTokenRegistryService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async collectionKeysByTokenIds(
    tokenIds: Array<string | number>,
  ): Promise<Record<number, string>> {
    return this.rwaTokenRegistry.collectionKeysByTokenIds(tokenIds);
  }

  /**
   * Lazy resolve scheduler — avoids ES module cycle:
   * collection.service → scheduler → snapshot.service → collection.service
   */
  private enqueueMarketSnapshotRefresh(collectionKey: string): void {
    setImmediate(() => {
      try {
        const { CollectionMarketSnapshotSchedulerService } =
          require('./collection-market-snapshot-scheduler.service') as typeof import('./collection-market-snapshot-scheduler.service');
        const scheduler = this.moduleRef.get(
          CollectionMarketSnapshotSchedulerService,
          { strict: false },
        );
        scheduler?.enqueue(collectionKey, 'cold_start');
      } catch (e) {
        this.logger.warn(
          `Market snapshot enqueue failed for ${collectionKey}: ${String(e)}`,
        );
      }
    });
  }

  private cardhedgerFromRwaMetadata(meta: Record<string, unknown>): {
    cardId: string | null;
    searchQuery: string | null;
    psaSpecId: string | null;
  } {
    const props = meta.properties as Record<string, unknown> | undefined;
    const graded = (props?.graded ?? meta.graded) as
      | Record<string, unknown>
      | undefined;
    if (!graded || typeof graded !== 'object') {
      return { cardId: null, searchQuery: null, psaSpecId: null };
    }
    const ch = graded.cardhedger as Record<string, unknown> | undefined;
    const cardId =
      typeof ch?.cardId === 'string' && ch.cardId.trim()
        ? ch.cardId.trim()
        : null;
    const searchQuery =
      typeof ch?.searchQuery === 'string' && ch.searchQuery.trim()
        ? ch.searchQuery.trim()
        : null;
    const psa = graded.psa as Record<string, unknown> | undefined;
    const specRaw = psa?.specId ?? psa?.SpecID ?? psa?.spec_id;
    const psaSpecId =
      typeof specRaw === 'number' && Number.isFinite(specRaw)
        ? String(Math.floor(specRaw))
        : typeof specRaw === 'string' && specRaw.trim()
          ? specRaw.trim()
          : null;
    return { cardId, searchQuery, psaSpecId };
  }

  private mintVariantFromGradedMeta(meta: Record<string, unknown>): string {
    const props = meta.properties as Record<string, unknown> | undefined;
    const graded = (props?.graded ?? meta.graded) as
      | Record<string, unknown>
      | undefined;
    if (!graded || typeof graded !== 'object') return '';
    const card = graded.card as Record<string, unknown> | undefined;
    return typeof card?.variant === 'string' ? card.variant.trim() : '';
  }

  /**
   * Re-merge `psaVariety` from mint `card.variant` when PSA only gives `{SPORT} REFRACTOR`
   * (e.g. Orange Basketball Refractor slabs). Updates `marketParallelKey` when variety changes.
   */
  async ensureMintParallelVarietyFromListings(
    collectionKey: string,
  ): Promise<boolean> {
    const k = collectionKey.toLowerCase();
    const row = await this.collectionRepo.findOne({
      where: { collectionKey: k },
    });
    if (!row) return false;

    const variants = new Set<string>();
    const asks = await this.activeListingsForCollection(k);
    for (const o of asks) {
      if (!o.tokenId || String(o.tokenId).trim() === '') continue;
      try {
        const uri = await this.blockchain.getRwaTokenURI(Number(o.tokenId));
        const meta = await this.ipfsResolver.fetchMetadataJson(uri);
        const cv = this.mintVariantFromGradedMeta(meta);
        if (cv) variants.add(cv);
      } catch {
        /* skip */
      }
    }
    if (variants.size > 1) {
      this.logger.warn(
        `Collection ${k}: conflicting mint card.variant across listings; not updating psaVariety`,
      );
      return false;
    }
    if (variants.size === 0) return false;

    const mintV = [...variants][0];
    const comp: Record<string, unknown> = { ...row.components };
    const merged = mergePsaVarietyWithMintVariant(
      String(comp.psaVariety ?? ''),
      mintV,
    );
    if (!merged) return false;

    let dirty = false;
    if (String(comp.mintCardVariant ?? '') !== mintV) {
      comp.mintCardVariant = mintV;
      dirty = true;
    }
    if (String(comp.psaVariety ?? '') !== merged) {
      comp.psaVariety = merged;
      dirty = true;
    }
    const nextParallel = marketParallelKeyFromPsaVariety(merged);
    if (String(comp.marketParallelKey ?? '').toLowerCase() !== nextParallel) {
      comp.marketParallelKey = nextParallel;
      dirty = true;
    }
    if (!dirty) return false;

    await this.collectionRepo.update(
      { collectionKey: k },
      {
        components: comp as QueryDeepPartialEntity<Record<string, unknown>>,
        marketParallelKey: nextParallel,
      },
    );
    this.logger.log(
      `Collection ${k}: psaVariety remerged from mint variant → ${merged}`,
    );
    return true;
  }

  private psaSpecIdFromComponentsRow(comp: unknown): string | null {
    if (!comp || typeof comp !== 'object') return null;
    const o = comp as Record<string, unknown>;
    const raw = o.psaSpecId;
    if (typeof raw === 'number' && Number.isFinite(raw))
      return String(Math.floor(raw));
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    return null;
  }

  /**
   * NFT `name` at listing time — matches the per-RWA title in the collection grid
   * (`metadata.name`). Stored on `components.listingDisplayTitle` for hero copy + Cardhedger search.
   */
  private extractListingDisplayTitleFromMeta(
    meta: Record<string, unknown>,
  ): string | null {
    const n = meta.name;
    if (typeof n !== 'string') return null;
    const t = n.trim().replace(/\s+/g, ' ');
    return t.length > 0 ? t : null;
  }

  /**
   * Boot maintenance (bucket migrate, RWA registry sync, Cardhedger audit) must not block
   * `app.listen()` — otherwise Compose healthchecks and all `/api/*` return 502 for minutes.
   */
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
        await this.auditStaleCardhedgerCardIdsOnBoot();
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
        const newKey = await this.ensureCollectionForListing(tid);
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

  /**
   * `MARKETPLACE_PIPELINE_DIAG=1` on boot: counts active asks with `collection_key` NULL (root cause for UI↔DB key skew).
   */
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

  /**
   * 기존 컬렉션 행에 `psaTotalPopulation`이 없을 때만 메타에서 채움 (첫 민트는 ensure 시 포함됨).
   */
  private async mergePsaPopulationFromMetaIfMissing(
    collectionKey: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    const fresh = extractBucketComponentsFromMetadata(meta);
    if (fresh?.psaTotalPopulation == null) return;
    const key = collectionKey.toLowerCase();
    const row = await this.collectionRepo.findOne({
      where: { collectionKey: key },
    });
    if (!row) return;
    const comp = row.components;
    if (comp.psaTotalPopulation != null) return;
    await this.collectionRepo.update(
      { collectionKey: key },
      {
        components: { ...comp, psaTotalPopulation: fresh.psaTotalPopulation },
      },
    );
  }

  /**
   * Fetch a clean catalog image for a card using metadata fields (no image buffer / OCR needed).
   *
   * Actual IPFS metadata field names (from GradedCardMetadata / MintForm):
   *   graded.card.name, graded.card.set, graded.card.number, graded.card.year
   *   graded.psa.certImageSourceUrl, graded.psa.category, graded.psa.specId
   *   graded.cardhedger.cardId
   *
   * Tried in order:
   *   1. PSA spec page scrape — when `specId` is known (메타·fallback·또는 Cert로
   *      `GetByCertNumber`에서 보강). 성공 시 여기서 종료.
   *      `PSA_SPEC_COVER_ALLOW_FALLBACK=1|true` 가 **아니면** specId가 있는데 스크랩이
   *      실패하면 아래 단계로 내려가지 않고 `null` 반환.
   *   2. Cardhedger card-details (cardId known) — specId 없거나 위 폴백 허용 시
   *   3. Cardhedger card-search  (name + number + set text query)
   *   4. Cardhedger image-search (certImageSourceUrl → visual matching)
   *   5. Pokemon TCG API         (Pokemon cards)
   */
  private async fetchCatalogImageFromMeta(
    meta: Record<string, unknown>,
    psaSpecIdFallback?: string | null,
  ): Promise<string | null> {
    const props = meta.properties as Record<string, unknown> | undefined;
    const graded = (props?.graded ?? meta.graded) as
      | Record<string, unknown>
      | undefined;
    const ch = graded?.cardhedger as Record<string, unknown> | undefined;
    const cardMeta = graded?.card as Record<string, unknown> | undefined;
    const psaMeta = graded?.psa as Record<string, unknown> | undefined;

    // ── 0. PSA spec page scrape (clean card-only image, no slab) ────────────
    const specIdRaw = psaMeta?.specId ?? psaMeta?.SpecID ?? psaMeta?.spec_id;
    const specIdFromMeta =
      typeof specIdRaw === 'number' && Number.isFinite(specIdRaw)
        ? String(Math.floor(specIdRaw))
        : typeof specIdRaw === 'string' && specIdRaw.trim()
          ? specIdRaw.trim()
          : '';
    let specId =
      specIdFromMeta ||
      (typeof psaSpecIdFallback === 'string' && psaSpecIdFallback.trim()
        ? psaSpecIdFallback.trim()
        : '');

    if (!specId) {
      const certRaw = psaCertNumberFromGradedMeta(meta);
      if (certRaw) {
        const snap = await this.psaCertSnapshots.fetchCertSnapshotJson(certRaw);
        const fromSnap = snap
          ? specIdStringFromPsaCertBody({ PSACert: snap })
          : null;
        if (fromSnap) {
          specId = fromSnap;
          this.logger.debug(
            `[CoverImg] SpecID from psa_cert_snapshots cert=${certRaw}`,
          );
        }
      }
    }

    if (specId) {
      const allowFallback =
        process.env.PSA_SPEC_COVER_ALLOW_FALLBACK === '1' ||
        process.env.PSA_SPEC_COVER_ALLOW_FALLBACK === 'true';
      try {
        const psaSpecImg = await this.psaSpecScraper.scrapeSpecImageUrl(specId);
        if (psaSpecImg) {
          const img = normalizeImageUrl(psaSpecImg);
          this.logger.log(`[CoverImg] PSA spec page → ${img.slice(0, 100)}`);
          return img;
        }
        this.logger.warn(
          `[CoverImg] PSA spec scrape returned null for specId=${specId}${
            allowFallback
              ? ' — falling back'
              : ' — no fallback (set PSA_SPEC_COVER_ALLOW_FALLBACK=1 to allow Cardhedger/TCG)'
          }`,
        );
      } catch (e) {
        this.logger.warn(
          `[CoverImg] PSA spec scrape failed specId=${specId}: ${e instanceof Error ? e.message : String(e)}${
            allowFallback
              ? ' — falling back'
              : ' — no fallback (set PSA_SPEC_COVER_ALLOW_FALLBACK=1 to allow Cardhedger/TCG)'
          }`,
        );
      }
      if (!allowFallback) return null;
      // fall through — Cardhedger / TCG may still resolve a catalog image
    }

    // Correct field names: card.name / card.set / card.number (not cardName/setName/cardNumber)
    const cardId = typeof ch?.cardId === 'string' ? ch.cardId.trim() : '';
    const cardName = (
      typeof cardMeta?.name === 'string'
        ? cardMeta.name
        : typeof psaMeta?.cardNameHint === 'string'
          ? psaMeta.cardNameHint
          : ''
    ).trim();
    const cardNumber = String(cardMeta?.number ?? psaMeta?.cardNumberHint ?? '')
      .replace(/^#/, '')
      .trim();
    const setName = (
      typeof cardMeta?.set === 'string'
        ? cardMeta.set
        : typeof psaMeta?.setHint === 'string'
          ? psaMeta.setHint
          : ''
    ).trim();
    const year = String(cardMeta?.year ?? psaMeta?.year ?? '').trim();
    const category = String(
      psaMeta?.category ?? cardMeta?.category ?? '',
    ).trim();
    const certImageUrl =
      typeof psaMeta?.certImageSourceUrl === 'string'
        ? psaMeta.certImageSourceUrl.trim()
        : '';

    // ── 1. Cardhedger card-details by stored cardId ──────────────────────────
    if (cardId) {
      try {
        this.cardhedger.assertConfigured();
        const body = await this.cardhedger.forwardJson(
          'POST',
          '/v1/cards/card-details',
          {
            body: { card_id: cardId },
          },
        );
        const cards = (body as { cards?: unknown[] }).cards;
        if (Array.isArray(cards) && cards.length > 0) {
          const row = cards[0] as Record<string, unknown>;
          const rawImg =
            typeof row.image === 'string' && row.image.trim()
              ? row.image.trim()
              : null;
          const img = rawImg ? normalizeImageUrl(rawImg) : null;
          if (img) {
            this.logger.log(
              `[CoverImg] Cardhedger card-details(id) → ${img.slice(0, 80)}`,
            );
            return img;
          }
        }
      } catch {
        /* fall through */
      }
    }

    // ── 2. Cardhedger card-search (text query) ───────────────────────────────
    if (cardName) {
      try {
        this.cardhedger.assertConfigured();
        const parts = [cardName, cardNumber, setName, year].filter(Boolean);
        const search = parts.join(' ');
        const body = await this.cardhedger.forwardJson(
          'POST',
          '/v1/cards/card-search',
          {
            body: { search, page: 1, page_size: 10 },
          },
        );
        const cards = Array.isArray((body as { cards?: unknown[] })?.cards)
          ? ((body as { cards: unknown[] }).cards ?? [])
          : [];

        // Normalise helpers (same as card-match.util)
        const normNum = (s: string) =>
          s
            .replace(/^#/, '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[^a-z0-9]/g, '');
        const normStr = (s: string) =>
          s
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[^a-z0-9]/g, '');

        const wantNum = normNum(cardNumber);
        const wantNameWords = normStr(cardName).match(/[a-z0-9]+/g) ?? [];
        const wantSet = normStr(setName);

        for (const row of cards as Record<string, unknown>[]) {
          const rawImg =
            typeof row.image === 'string' && row.image.trim()
              ? row.image.trim()
              : null;
          if (!rawImg) continue;
          const img = normalizeImageUrl(rawImg);

          const rowNum = normNum(String(row.number ?? ''));
          const rowDesc = normStr(String(row.description ?? row.name ?? ''));
          const rowSet = normStr(String(row.set ?? ''));

          // Must match card number when we have one, to avoid completely wrong cards
          const numOk = !wantNum || rowNum === wantNum;
          // Name fuzzy: all key words appear in description
          const nameOk =
            wantNameWords.length === 0 ||
            wantNameWords.every((w) => rowDesc.includes(w));
          // Set substring match (handles year prefix differences)
          const setOk =
            !wantSet || rowSet.includes(wantSet) || wantSet.includes(rowSet);

          if (numOk && (nameOk || setOk)) {
            this.logger.log(
              `[CoverImg] Cardhedger card-search → ${img.slice(0, 80)}`,
            );
            return img;
          }
        }
      } catch {
        /* fall through */
      }
    }

    // ── 3. Cardhedger image-search via PSA cert image URL ───────────────────
    if (certImageUrl) {
      try {
        this.cardhedger.assertConfigured();
        // Fetch the PSA slab image and pass as base64 to image-search
        const imgRes = await fetch(certImageUrl, {
          signal: AbortSignal.timeout(10_000),
          headers: { 'User-Agent': 'TokenableBackend/1.0' },
        });
        if (imgRes.ok) {
          const buf = Buffer.from(await imgRes.arrayBuffer());
          const jpg = (await import('sharp'))
            .default(buf)
            .resize({ width: 1200, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 });
          const b64 = `data:image/jpeg;base64,${(await jpg.toBuffer()).toString('base64')}`;
          const raw = await this.cardhedger.forwardJson(
            'POST',
            '/v1/cards/image-search',
            {
              body: { image_base64: b64 },
            },
          );
          const searchCards = Array.isArray(
            (raw as { cards?: unknown[] })?.cards,
          )
            ? ((raw as { cards: unknown[] }).cards ?? [])
            : [];
          const first = searchCards[0] as Record<string, unknown> | undefined;
          const rawFirst =
            typeof first?.image === 'string' && first.image.trim()
              ? first.image.trim()
              : null;
          const img = rawFirst ? normalizeImageUrl(rawFirst) : null;
          if (img) {
            this.logger.log(
              `[CoverImg] Cardhedger image-search → ${img.slice(0, 80)}`,
            );
            return img;
          }
        }
      } catch {
        /* fall through */
      }
    }

    // ── 4. Pokemon TCG API (free, official images) ───────────────────────────
    const isPokemon =
      /pokemon/i.test(setName) ||
      /pokemon/i.test(cardName) ||
      /tcg/i.test(category);

    if (isPokemon && cardName) {
      try {
        const name = cardName.replace(/"/g, '').trim();
        const num = cardNumber.replace(/"/g, '').trim();
        const parts = [`name:"${name}"`];
        if (num) parts.push(`number:${num}`);
        const q = encodeURIComponent(parts.join(' '));
        const url = `https://api.pokemontcg.io/v2/cards?q=${q}&pageSize=20&select=id,name,number,set,images`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'TokenableBackend/1.0' },
          signal: AbortSignal.timeout(8_000),
        });
        if (res.ok) {
          const data = (await res.json()) as { data?: unknown[] };
          const cards = (data.data ?? []) as Record<string, unknown>[];
          const sorted = cards.sort((a, b) => {
            const yearOf = (c: Record<string, unknown>) =>
              (
                (c.set as Record<string, unknown>)?.releaseDate as
                  | string
                  | undefined
              )?.slice(0, 4) ?? '';
            return yearOf(a) === year ? -1 : yearOf(b) === year ? 1 : 0;
          });
          const best = sorted[0];
          const images = best?.images as Record<string, string> | undefined;
          const img = images?.large ?? images?.small ?? null;
          if (img) {
            this.logger.log(`[CoverImg] Pokemon TCG API → ${img.slice(0, 80)}`);
            return img;
          }
        }
      } catch {
        /* fall through */
      }
    }

    return null;
  }

  /**
   * Pick the best collection cover URL from metadata — cert number must NOT be visible.
   * Priority:
   *   1. Cardhedger catalog image / Pokemon TCG API (clean card, no slab)
   *   2. `graded.cardhedger.imageUrl` already stored in metadata
   *   3. `collectionCoverImage` (IPFS, Sharp-cropped slab)
   *   4. PSA `certImageSourceUrl` only as last resort (full slab, cert number visible)
   */
  private async resolveBestCoverUrl(
    meta: Record<string, unknown>,
    psaSpecIdFallback?: string | null,
  ): Promise<string | null> {
    // Try to fetch a clean catalog image at registration time
    const catalogImg = await this.fetchCatalogImageFromMeta(
      meta,
      psaSpecIdFallback,
    );
    if (catalogImg) return catalogImg;

    // Fall back to what's stored in metadata
    const ref = extractCollectionRepresentativeImage(meta);
    if (!ref) return null;
    if (/^https?:\/\//i.test(ref) && !ref.toLowerCase().includes('/ipfs/')) {
      return ref;
    }
    // IPFS ref → resolve to gateway HTTPS
    try {
      const resolved = await Promise.race([
        this.ipfsResolver.resolveImageToHttps(ref),
        new Promise<null>((res) => setTimeout(() => res(null), 8_000)),
      ]);
      return resolved ?? ref;
    } catch {
      return ref;
    }
  }

  /**
   * Whether a URL is a "low-quality" cover that should be upgraded if a better source exists.
   *
   * PSA CloudFront has two kinds of images on the same host:
   *   • `/cert/{certNumber}/...` → full slab photo with cert label → UPGRADEABLE
   *   • `/spec/{specId}/...`     → card-only image (no slab)       → already high-quality
   */
  private isCoverUrlUpgradeable(url: string): boolean {
    const t = url.trim();
    if (!t) return true;
    if (/^ipfs:\/\//i.test(t)) return true;
    if (/^https?:\/\//i.test(t) && t.toLowerCase().includes('/ipfs/'))
      return true;
    if (t.includes('d1htnxwo4o0jhw.cloudfront.net/cert/')) return true;
    return false;
  }

  /** Direct, high-quality HTTPS source: Cardhedger catalog, Pokemon TCG, or PSA spec page. */
  private isHighQualityCoverUrl(url: string): boolean {
    const t = url.trim();
    if (!t) return false;
    if (!/^https?:\/\//i.test(t)) return false;
    if (t.toLowerCase().includes('/ipfs/')) return false;
    if (t.includes('d1htnxwo4o0jhw.cloudfront.net/cert/')) return false;
    return true;
  }

  /**
   * Whether the stored cover should be replaced with a direct HTTPS catalog/spec URL if possible.
   * Used by CollectionsController to optionally await resolution on first paint.
   */
  coverImageNeedsUpgrade(url: string | null | undefined): boolean {
    const t = (url ?? '').trim();
    if (!t) return true;
    return this.isCoverUrlUpgradeable(t);
  }

  /**
   * Persist collection cover only while `cover_image_url` is still empty (first cover wins).
   * Admin override: {@link setCollectionCoverImageAdmin}.
   */
  private async persistCoverFromMetaIfMissing(
    collectionKey: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    const key = collectionKey.toLowerCase();
    const row = await this.collectionRepo.findOne({
      where: { collectionKey: key },
    });
    if (!row) return;

    const existing = row.coverImageUrl?.trim() ?? '';
    if (existing) return;

    const specFb = this.psaSpecIdFromComponentsRow(row.components);
    const img = await this.resolveBestCoverUrl(meta, specFb);
    if (!img) return;

    await this.collectionRepo.update(
      { collectionKey: key },
      { coverImageUrl: img },
    );
    this.logger.log(
      `[CoverImg] first cover for ${key}: "${img.slice(0, 72)}"`,
    );
  }

  private async mergeTrendingSlabMetaFromMetaIfMissing(
    collectionKey: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    const key = collectionKey.toLowerCase();
    const row = await this.collectionRepo.findOne({
      where: { collectionKey: key },
    });
    if (!row) return;
    const comp = row.components;
    const next = { ...comp };
    let dirty = false;
    const slab = pickTrendingSlabImageRef(meta);
    if (
      slab &&
      !(
        typeof comp.trendingSlabImageUrl === 'string' &&
        comp.trendingSlabImageUrl.trim()
      )
    ) {
      next.trendingSlabImageUrl = slab;
      dirty = true;
    }
    const cert = psaCertNumberFromGradedMeta(meta);
    const certCol = row.psaCertNumber?.trim() || '';
    const certDirty = Boolean(cert && cert !== certCol);
    if (dirty || certDirty) {
      await this.collectionRepo.update(
        { collectionKey: key },
        {
          ...(dirty
            ? {
                components: next as QueryDeepPartialEntity<
                  Record<string, unknown>
                >,
              }
            : {}),
          ...(certDirty ? { psaCertNumber: cert } : {}),
        },
      );
    }
  }

  /**
   * 매도(ask) 등록 시: 메타에서 버킷·컬렉션 라벨 문구를 읽어 컬렉션 행을 만들고 key 반환.
   * graded 없으면 null (주문은 그대로 저장, 컬렉션 미부여).
   */
  async ensureCollectionForListing(tokenId: string): Promise<string | null> {
    const uri = await this.blockchain.getRwaTokenURI(Number(tokenId));
    const meta = await this.ipfsResolver.fetchMetadataJson(uri);
    const extracted = extractOrDiagnoseBucketComponents(meta);
    if (!extracted.ok) {
      this.logger.warn(
        JSON.stringify({
          msg: 'collection_key_pipeline',
          step: 'ensureCollectionForListing',
          outcome: 'extract_bucket_failed',
          tokenId: String(tokenId),
          tokenUriSample:
            typeof uri === 'string'
              ? uri.slice(0, 120)
              : String(uri).slice(0, 120),
          diagnosis: {
            code: extracted.code,
            gradedSource: extracted.gradedSource,
            detail: extracted.detail,
          },
          metaSample: metaShapeSampleForBucketLog(meta),
        }),
      );
      return null;
    }
    const components = extracted.components;

    const queryUsed = extractCollectionQueryUsed(meta);
    const displayLabel = buildCollectionDisplayLabel(components, queryUsed);
    const collectionKey = computeMarketBucketKey(components);
    const diagOn =
      this.config.get<string>('MARKETPLACE_PIPELINE_DIAG') === '1' ||
      this.config.get<string>('MARKETPLACE_PIPELINE_DIAG') === 'true';
    if (diagOn) {
      this.logger.log(
        JSON.stringify({
          msg: 'collection_key_pipeline',
          step: 'ensureCollectionForListing',
          outcome: 'bucket_key_computed',
          tokenId: String(tokenId),
          collectionKey,
          gradedSource: extracted.gradedSource,
          keyFormatNote:
            'sha256 hex is lowercase in Node crypto; DB stores this string.',
        }),
      );
    }
    const ch = this.cardhedgerFromRwaMetadata(meta);
    const coverImageUrl = await this.resolveBestCoverUrl(meta, ch.psaSpecId);

    const compRecord: Record<string, unknown> = {
      ...(components as unknown as Record<string, unknown>),
    };
    const listingTitle = this.extractListingDisplayTitleFromMeta(meta);
    if (listingTitle) {
      compRecord.listingDisplayTitle = listingTitle;
    }
    if (ch.cardId) {
      compRecord.cardhedgerCardId = ch.cardId;
      if (ch.searchQuery) compRecord.cardhedgerSearchQuery = ch.searchQuery;
    }
    if (ch.psaSpecId) {
      compRecord.psaSpecId = ch.psaSpecId;
    }

    const trendingSlab = pickTrendingSlabImageRef(meta);
    if (trendingSlab) {
      compRecord.trendingSlabImageUrl = trendingSlab;
    }
    const psaCert = psaCertNumberFromGradedMeta(meta);

    const gradedSrc =
      (meta.properties as Record<string, unknown> | undefined)?.graded ??
      meta.graded;
    if (gradedSrc && typeof gradedSrc === 'object') {
      const g = gradedSrc as Record<string, unknown>;
      const psa = g.psa as Record<string, unknown> | undefined;
      const card = g.card as Record<string, unknown> | undefined;
      if (psa && typeof psa === 'object') {
        const p = psa as Record<string, unknown>;
        const subject = String(p.subject ?? p.Subject ?? '').trim();
        const brand = String(p.brand ?? p.Brand ?? '').trim();
        const category = String(p.category ?? p.Category ?? '').trim();
        const pvar = String(p.variety ?? p.Variety ?? '').trim();
        const pnum = String(
          p.cardNumber ?? p.CardNumber ?? p.card_number ?? '',
        ).trim();
        const yearRaw = p.year ?? p.Year ?? p.YearIssued;
        const year =
          yearRaw != null && yearRaw !== ''
            ? String(yearRaw).replace(/\D/g, '').slice(0, 4)
            : '';
        const gradeDesc = String(
          p.gradeDescription ?? p.GradeDescription ?? '',
        ).trim();
        const labelType = String(p.labelType ?? p.LabelType ?? '').trim();
        if (subject) compRecord.psaSubject = subject;
        if (brand) compRecord.psaBrand = brand;
        if (category) compRecord.psaCategory = category;
        if (pnum) compRecord.psaCardNumber = pnum;
        if (year) compRecord.psaYear = year;
        if (gradeDesc) compRecord.psaGradeDescription = gradeDesc;
        const gradeLabel = String(p.gradeLabel ?? p.GradeLabel ?? '').trim();
        if (gradeLabel) compRecord.psaGradeLabel = gradeLabel;
        if (labelType) compRecord.psaLabelType = labelType;
        const cv = String(card?.variant ?? '').trim();
        if (cv) compRecord.mintCardVariant = cv;
        const mergedVariety = mergePsaVarietyWithMintVariant(pvar, cv);
        if (mergedVariety) compRecord.psaVariety = mergedVariety;
      } else {
        const cv = String(card?.variant ?? '').trim();
        if (cv) {
          compRecord.mintCardVariant = cv;
          compRecord.psaVariety = mergePsaVarietyWithMintVariant(
            String(compRecord.psaVariety ?? ''),
            cv,
          );
        }
      }
    }

    const parallelKey = marketParallelKeyFromPsaVariety(
      String(compRecord.psaVariety ?? ''),
    );
    compRecord.marketParallelKey = parallelKey;

    const row = this.collectionRepo.create({
      collectionKey,
      displayLabel,
      queryUsed,
      components: compRecord,
      coverImageUrl,
      psaCertNumber: psaCert ?? null,
      marketParallelKey: parallelKey,
      bucketKeyVersion: BUCKET_KEY_VERSION,
    });
    try {
      await this.collectionRepo.save(row);
    } catch (e) {
      const code =
        e instanceof QueryFailedError
          ? (e as unknown as { driverError?: { code?: string } }).driverError
              ?.code
          : undefined;
      if (code === '23505') {
        await this.persistCoverFromMetaIfMissing(collectionKey, meta);
        await this.mergePsaPopulationFromMetaIfMissing(collectionKey, meta);
        await this.mergeCardhedgerCardIdFromMetaIfMissing(collectionKey, meta);
        await this.mergeListingDisplayTitleFromMetaIfMissing(
          collectionKey,
          meta,
        );
        await this.mergeTrendingSlabMetaFromMetaIfMissing(collectionKey, meta);
      } else {
        throw e;
      }
    }

    void this.rwaTokenRegistry.upsertFromMetadata(tokenId, meta, {
      tokenUri: uri,
      collectionKey,
    });
    if (psaCert) {
      this.psaCertSnapshots.scheduleRefreshIfNeeded(psaCert);
    }

    this.enqueueMarketSnapshotRefresh(collectionKey);

    return collectionKey;
  }

  private encodeCollectionCursor(row: {
    createdAt: Date;
    collectionKey: string;
  }): string {
    const payload = {
      ca: row.createdAt.toISOString(),
      ck: row.collectionKey.toLowerCase(),
    };
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  private decodeCollectionCursor(cursor: string): { ca: Date; ck: string } {
    const j = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      ca: string;
      ck: string;
    };
    return { ca: new Date(j.ca), ck: String(j.ck).toLowerCase() };
  }

  /**
   * Cursor-paginated collection summaries (stable sort: createdAt DESC, collectionKey ASC).
   * Newest buckets first so a fresh listing appears on page 1 without “load more” to the end.
   */
  async listSummariesPaged(input: {
    limit?: number;
    cursor?: string | null;
  }): Promise<{
    items: CollectionSummary[];
    nextCursor: string | null;
  }> {
    const limit = Math.min(Math.max(input.limit ?? 30, 1), 60);
    const qb = this.collectionRepo.createQueryBuilder('c');

    const cur = input.cursor?.trim();
    if (cur) {
      try {
        const { ca, ck } = this.decodeCollectionCursor(cur);
        /** Keyset page after (ca, ck) for ORDER BY created_at DESC, collection_key ASC */
        qb.where(
          '(c.created_at < :ca OR (c.created_at = :ca AND c.collection_key > :ck))',
          { ca, ck },
        );
      } catch {
        /* invalid cursor — ignore */
      }
    }

    qb.orderBy('c.created_at', 'DESC')
      .addOrderBy('c.collection_key', 'ASC')
      .take(limit + 1);

    const rows = await qb.getMany();
    const page = rows.slice(0, limit);
    const hasMore = rows.length > limit;
    const nextCursor =
      hasMore && page.length > 0
        ? this.encodeCollectionCursor({
            createdAt: page[page.length - 1].createdAt,
            collectionKey: page[page.length - 1].collectionKey,
          })
        : null;

    if (page.length === 0) {
      return { items: [], nextCursor: null };
    }

    const keys = page.map((c) => c.collectionKey.toLowerCase());
    const countRows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.collection_key', 'key')
      .addSelect('COUNT(o.id)::int', 'cnt')
      .where('o.collection_key IS NOT NULL')
      .andWhere('o.collection_key IN (:...keys)', { keys })
      .andWhere('o.status = :st', { st: OrderStatus.ACTIVE })
      .andWhere('o.side = :side', { side: OrderSide.ASK })
      .groupBy('o.collection_key')
      .getRawMany<{ key: string; cnt: number }>();

    const countMap = new Map<string, number>();
    for (const r of countRows) {
      countMap.set(String(r.key).toLowerCase(), Number(r.cnt));
    }

    const items: CollectionSummary[] = page.map((c) => ({
      collectionKey: c.collectionKey,
      displayLabel: c.displayLabel,
      queryUsed: c.queryUsed,
      components: enrichCollectionComponentsForApi(
        c.components,
        c.psaCertNumber,
      ),
      createdAt: c.createdAt,
      activeListingCount: countMap.get(c.collectionKey.toLowerCase()) ?? 0,
      coverImageUrl: c.coverImageUrl ?? null,
    }));

    return { items, nextCursor };
  }

  async findOne(key: string): Promise<MarketplaceCollection | null> {
    return this.collectionRepo.findOne({
      where: { collectionKey: key.toLowerCase() },
    });
  }

  /**
   * DB `components.psaTotalPopulation`이 비어 있을 때, 활성 ask의 IPFS 메타에서 PSA 인구를 읽어 저장.
   * (구버전 컬렉션 행 보강 — 시가총액 등 프론트 계산용)
   */
  async ensurePsaTotalPopulationFromListings(
    collectionKey: string,
  ): Promise<void> {
    const k = collectionKey.toLowerCase();
    const row = await this.collectionRepo.findOne({
      where: { collectionKey: k },
    });
    if (!row) return;
    const comp = row.components;
    if (
      typeof comp.psaTotalPopulation === 'number' &&
      comp.psaTotalPopulation > 0
    ) {
      return;
    }

    const asks = await this.activeListingsForCollection(k);
    for (const o of asks) {
      if (!o.tokenId || String(o.tokenId).trim() === '') continue;
      try {
        const uri = await this.blockchain.getRwaTokenURI(Number(o.tokenId));
        const meta = await this.ipfsResolver.fetchMetadataJson(uri);
        const extracted = extractBucketComponentsFromMetadata(meta);
        let pop: number | undefined = extracted?.psaTotalPopulation;
        if (pop == null || !Number.isFinite(pop) || pop <= 0) {
          const graded =
            (meta.properties as Record<string, unknown> | undefined)?.graded ??
            meta.graded;
          const psa =
            graded && typeof graded === 'object'
              ? (graded as Record<string, unknown>).psa
              : undefined;
          const raw =
            psa && typeof psa === 'object'
              ? (psa as Record<string, unknown>).totalPopulation
              : undefined;
          if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
            pop = Math.floor(raw);
          }
        }
        if (pop != null && Number.isFinite(pop) && pop > 0) {
          await this.collectionRepo.update(
            { collectionKey: k },
            { components: { ...comp, psaTotalPopulation: Math.floor(pop) } },
          );
          return;
        }
      } catch {
        /* try next listing */
      }
    }
  }

  /**
   * `components.cardhedgerCardId` 보강: 활성 ask 메타에서 읽되, 서로 다른 id가 섞이면 저장하지 않음.
   */
  async ensureCardhedgerCardIdFromListings(
    collectionKey: string,
  ): Promise<boolean> {
    const k = collectionKey.toLowerCase();
    const row = await this.collectionRepo.findOne({
      where: { collectionKey: k },
    });
    if (!row) return false;
    const comp = row.components;
    const existing =
      typeof comp.cardhedgerCardId === 'string'
        ? comp.cardhedgerCardId.trim()
        : '';
    const existingQ =
      typeof comp.cardhedgerSearchQuery === 'string'
        ? comp.cardhedgerSearchQuery.trim()
        : '';

    const asks = await this.activeListingsForCollection(k);
    const ids = new Set<string>();
    const queries = new Set<string>();
    for (const o of asks) {
      if (!o.tokenId || String(o.tokenId).trim() === '') continue;
      try {
        const uri = await this.blockchain.getRwaTokenURI(Number(o.tokenId));
        const meta = await this.ipfsResolver.fetchMetadataJson(uri);
        const ch = this.cardhedgerFromRwaMetadata(meta);
        if (ch.cardId) ids.add(ch.cardId);
        if (ch.searchQuery) queries.add(ch.searchQuery);
      } catch {
        /* skip */
      }
    }

    if (ids.size > 1) {
      this.logger.warn(
        `Collection ${k}: conflicting cardhedgerCardId across active listings (${[...ids].join(', ')}); not updating`,
      );
      return false;
    }
    if (ids.size === 0) return false;

    const only = [...ids][0];
    const nextComp: Record<string, unknown> = { ...comp };
    let dirty = false;
    if (existing !== only) {
      nextComp.cardhedgerCardId = only;
      dirty = true;
    }
    if (queries.size === 1) {
      const q = [...queries][0];
      if (q && existingQ !== q) {
        nextComp.cardhedgerSearchQuery = q;
        dirty = true;
      }
    }
    if (!dirty) return false;
    await this.collectionRepo.update(
      { collectionKey: k },
      {
        components: nextComp as QueryDeepPartialEntity<Record<string, unknown>>,
      },
    );
    return true;
  }

  /** 활성 ask 메타에서 단일 cert → `psa_cert_number` 컬럼 (충돌 시 미저장). */
  async ensurePsaCertNumberFromListings(collectionKey: string): Promise<void> {
    const k = collectionKey.toLowerCase();
    const row = await this.collectionRepo.findOne({
      where: { collectionKey: k },
    });
    if (!row) return;

    const colC = row.psaCertNumber?.trim() || '';
    const asks = await this.activeListingsForCollection(k);
    const certs = new Set<string>();
    for (const o of asks) {
      if (!o.tokenId || String(o.tokenId).trim() === '') continue;
      try {
        const uri = await this.blockchain.getRwaTokenURI(Number(o.tokenId));
        const meta = await this.ipfsResolver.fetchMetadataJson(uri);
        const c = psaCertNumberFromGradedMeta(meta);
        if (c) certs.add(c);
      } catch {
        /* skip */
      }
    }

    if (certs.size > 1) {
      this.logger.warn(
        `Collection ${k}: conflicting PSA cert numbers across active listings; not updating`,
      );
      return;
    }
    if (certs.size === 0) return;

    const only = [...certs][0];
    if (colC === only) return;

    await this.collectionRepo.update(
      { collectionKey: k },
      { psaCertNumber: only },
    );
    this.psaCertSnapshots.scheduleRefreshIfNeeded(only);
  }

  /**
   * Overlay PSA Public API fields onto `components` for Cardhedger resolve
   * (PSA Brand/Subject/Variety are authoritative vs abbreviated mint set lines).
   */
  mergePsaSnapshotIntoComponents(
    col: MarketplaceCollection,
    snap: Record<string, unknown> | null,
  ): MarketplaceCollection {
    if (!snap || typeof snap !== 'object') return col;
    const merged = mergePsaCertSnapshotIntoMirror(col.components, snap);
    const comp: Record<string, unknown> = { ...col.components };
    let dirty = false;
    for (const key of Object.keys(merged)) {
      const next = merged[key];
      if (String(comp[key] ?? '') !== String(next ?? '')) {
        comp[key] = next;
        dirty = true;
      }
    }
    const mintV = String(comp.mintCardVariant ?? '').trim();
    const reconciled = mergePsaVarietyWithMintVariant(
      String(comp.psaVariety ?? ''),
      mintV,
    );
    if (reconciled && reconciled !== String(comp.psaVariety ?? '')) {
      comp.psaVariety = reconciled;
      dirty = true;
    }
    const nextParallel = marketParallelKeyFromPsaVariety(
      String(comp.psaVariety ?? ''),
    );
    if (String(comp.marketParallelKey ?? '').toLowerCase() !== nextParallel) {
      comp.marketParallelKey = nextParallel;
      dirty = true;
    }
    if (String(col.marketParallelKey ?? '').toLowerCase() !== nextParallel) {
      dirty = true;
    }
    if (!dirty) return col;
    return {
      ...col,
      components: comp,
      marketParallelKey: nextParallel,
    };
  }

  /**
   * Upstream PSA Public API — only when allowed and mirror/cache still insufficient.
   */
  async refreshPsaPublicSnapshotForCollection(
    collectionKey: string,
    opts?: { allowUpstream?: boolean },
  ): Promise<void> {
    if (opts?.allowUpstream === false) return;
    const k = collectionKey.toLowerCase();
    const row = await this.collectionRepo.findOne({
      where: { collectionKey: k },
    });
    if (!row) return;
    const cert = psaCertNumberFromCollectionRow(row);
    if (!cert) return;

    if (componentsPsaMirrorSufficientForCardhedger(row.components)) {
      const fresh = await this.psaCertSnapshots.getSnapshotJsonIfFresh(cert);
      if (fresh) return;
    }

    await this.psaCertSnapshots.refreshIfStale(cert);
  }

  async mergePsaSnapshotIntoComponentsFromDb(
    col: MarketplaceCollection,
  ): Promise<MarketplaceCollection> {
    const cert = psaCertNumberFromCollectionRow(col);
    if (!cert) return col;
    const snap = await this.psaCertSnapshots.getSnapshotJsonIfFresh(cert);
    return this.mergePsaSnapshotIntoComponents(col, snap);
  }

  private extractCardhedgerCardDataRow(
    raw: unknown,
  ): Record<string, unknown> | null {
    if (typeof raw !== 'object' || raw == null) return null;
    const cards = (raw as { cards?: unknown[] }).cards;
    if (!Array.isArray(cards) || cards.length === 0) return null;
    const row = cards[0];
    return typeof row === 'object' && row != null
      ? (row as Record<string, unknown>)
      : null;
  }

  async auditCardhedgerCardIdExact(
    collectionKey: string,
    options?: { clearOnMismatch?: boolean },
  ): Promise<{
    checked: boolean;
    ok: boolean;
    cleared: boolean;
    failCodes: string[];
  }> {
    const k = collectionKey.toLowerCase();
    const dbRow = await this.collectionRepo.findOne({
      where: { collectionKey: k },
    });
    if (!dbRow) {
      return {
        checked: false,
        ok: false,
        cleared: false,
        failCodes: ['collection_not_found'],
      };
    }
    const comp = dbRow.components;
    const cardId =
      typeof comp.cardhedgerCardId === 'string'
        ? comp.cardhedgerCardId.trim()
        : '';
    if (!cardId)
      return { checked: false, ok: true, cleared: false, failCodes: [] };

    const wantName = String(comp.cardName ?? '').trim();
    const wantSet = String(comp.cardSet ?? '').trim();
    const wantNum = String(comp.cardNumber ?? '').trim();
    if (!wantName || !wantSet || !wantNum) {
      return {
        checked: true,
        ok: false,
        cleared: false,
        failCodes: ['incomplete_components'],
      };
    }

    let raw: unknown;
    try {
      raw = await this.cardhedger.forwardJson(
        'POST',
        '/v1/cards/card-details',
        {
          body: { card_id: cardId },
        },
      );
    } catch (e) {
      return {
        checked: true,
        ok: false,
        cleared: false,
        failCodes: ['upstream_fetch_failed'],
      };
    }
    const row = this.extractCardhedgerCardDataRow(raw);
    if (!row)
      return {
        checked: true,
        ok: false,
        cleared: false,
        failCodes: ['empty_card_payload'],
      };
    const ex = exactCatalogMatch(
      { cardName: wantName, cardSet: wantSet, cardNumber: wantNum },
      {
        name: String(row.description ?? row.name ?? ''),
        cardNumber: String(row.number ?? ''),
        set: { name: String(row.set ?? '') },
      },
    );
    if (ex.ok)
      return { checked: true, ok: true, cleared: false, failCodes: [] };

    if (options?.clearOnMismatch) {
      const nextComponents: Record<string, unknown> = { ...comp };
      delete nextComponents.cardhedgerCardId;
      delete nextComponents.cardhedgerSearchQuery;
      await this.collectionRepo.update(
        { collectionKey: k },
        {
          components: nextComponents as QueryDeepPartialEntity<
            Record<string, unknown>
          >,
        },
      );
      return {
        checked: true,
        ok: false,
        cleared: true,
        failCodes: ex.failCodes,
      };
    }
    return {
      checked: true,
      ok: false,
      cleared: false,
      failCodes: ex.failCodes,
    };
  }

  private async auditStaleCardhedgerCardIdsOnBoot(): Promise<void> {
    const rows = await this.collectionRepo.find({
      select: ['collectionKey', 'components'],
    });
    let cleared = 0;
    let mismatchNotCleared = 0;
    let incomplete = 0;
    for (const c of rows) {
      const comp = c.components;
      if (
        typeof comp.cardhedgerCardId !== 'string' ||
        !comp.cardhedgerCardId.trim()
      )
        continue;
      const r = await this.auditCardhedgerCardIdExact(c.collectionKey, {
        clearOnMismatch: true,
      });
      if (!r.checked) continue;
      if (r.ok) continue;
      if (r.failCodes.includes('incomplete_components')) {
        incomplete++;
        continue;
      }
      if (r.cleared) cleared++;
      else mismatchNotCleared++;
    }
    this.logger.warn(
      JSON.stringify({
        msg: 'cardhedger_collection_boot_audit_summary',
        collectionsTableRows: rows.length,
        staleCardhedgerIdsCleared: cleared,
        mismatchesNotCleared: mismatchNotCleared,
        incompleteComponents: incomplete,
      }),
    );
  }

  /** Backward-compatible alias now backed by Cardhedger exact verification. */
  async auditCollectionCardIdExact(
    collectionKey: string,
    options?: { clearOnMismatch?: boolean },
  ): Promise<{
    checked: boolean;
    ok: boolean;
    cleared: boolean;
    failCodes: string[];
  }> {
    return this.auditCardhedgerCardIdExact(collectionKey, options);
  }

  /** duplicate key race 시 메타에만 있고 DB에 없는 cardhedger id/searchQuery 병합 */
  private async mergeCardhedgerCardIdFromMetaIfMissing(
    collectionKey: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    const key = collectionKey.toLowerCase();
    const dbRow = await this.collectionRepo.findOne({
      where: { collectionKey: key },
    });
    if (!dbRow) return;
    const comp = dbRow.components;
    if (
      typeof comp.cardhedgerCardId === 'string' &&
      comp.cardhedgerCardId.trim()
    ) {
      return;
    }
    const ch = this.cardhedgerFromRwaMetadata(meta);
    if (!ch.cardId) return;
    await this.collectionRepo.update(
      { collectionKey: key },
      {
        components: {
          ...comp,
          cardhedgerCardId: ch.cardId,
          ...(ch.psaSpecId ? { psaSpecId: ch.psaSpecId } : {}),
          ...(ch.searchQuery ? { cardhedgerSearchQuery: ch.searchQuery } : {}),
        } as QueryDeepPartialEntity<Record<string, unknown>>,
      },
    );
  }

  /** Duplicate-key race: fill `listingDisplayTitle` when the row was created by another listing first. */
  private async mergeListingDisplayTitleFromMetaIfMissing(
    collectionKey: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    const key = collectionKey.toLowerCase();
    const dbRow = await this.collectionRepo.findOne({
      where: { collectionKey: key },
    });
    if (!dbRow) return;
    const comp = dbRow.components;
    const existing =
      typeof comp.listingDisplayTitle === 'string'
        ? comp.listingDisplayTitle.trim()
        : '';
    if (existing.length > 0) return;
    const t = this.extractListingDisplayTitleFromMeta(meta);
    if (!t) return;
    await this.collectionRepo.update(
      { collectionKey: key },
      {
        components: {
          ...comp,
          listingDisplayTitle: t,
        } as QueryDeepPartialEntity<Record<string, unknown>>,
      },
    );
  }

  /**
   * Legacy rows: backfill `components.listingDisplayTitle` from the first active ask's IPFS `name`
   * when missing (aligns collection detail hero with the in-grid RWA title).
   */
  async ensureListingDisplayTitleFromListings(
    collectionKey: string,
  ): Promise<void> {
    const k = collectionKey.toLowerCase();
    const row = await this.collectionRepo.findOne({
      where: { collectionKey: k },
    });
    if (!row) return;
    const comp = row.components;
    const existing =
      typeof comp.listingDisplayTitle === 'string'
        ? comp.listingDisplayTitle.trim()
        : '';
    if (existing.length > 0) return;

    const asks = await this.activeListingsForCollection(k);
    for (const o of asks) {
      if (!o.tokenId || String(o.tokenId).trim() === '') continue;
      try {
        const uri = await this.blockchain.getRwaTokenURI(Number(o.tokenId));
        const meta = await this.ipfsResolver.fetchMetadataJson(uri);
        const t = this.extractListingDisplayTitleFromMeta(meta);
        if (!t) continue;
        await this.collectionRepo.update(
          { collectionKey: k },
          {
            components: {
              ...comp,
              listingDisplayTitle: t,
            } as QueryDeepPartialEntity<Record<string, unknown>>,
          },
        );
        return;
      } catch {
        /* try next listing */
      }
    }
  }

  async activeListingsForCollection(collectionKey: string): Promise<Order[]> {
    return this.orderRepo.find({
      where: {
        collectionKey: collectionKey.toLowerCase(),
        status: OrderStatus.ACTIVE,
        side: OrderSide.ASK,
      },
      order: { createdAt: 'ASC' },
    });
  }

  /** 같은 컬렉션의 활성 Seaport 매수 입찰 (collection_key는 bid 생성 시 부여됨) */
  async activeBidsForCollection(collectionKey: string): Promise<Order[]> {
    return this.orderRepo.find({
      where: {
        collectionKey: collectionKey.toLowerCase(),
        status: OrderStatus.ACTIVE,
        side: OrderSide.BID,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Admin-only: replace collection cover (ignores first-cover freeze).
   */
  async setCollectionCoverImageAdmin(
    collectionKey: string,
    coverImageUrl: string,
  ): Promise<MarketplaceCollection> {
    const k = collectionKey.toLowerCase();
    const url = coverImageUrl.trim();
    if (!url) {
      throw new Error('COLLECTION_COVER_URL_EMPTY');
    }
    if (!/^https?:\/\//i.test(url) && !/^ipfs:\/\//i.test(url)) {
      throw new Error('COLLECTION_COVER_URL_INVALID');
    }
    const row = await this.findOne(k);
    if (!row) {
      throw new Error('COLLECTION_NOT_FOUND');
    }
    await this.collectionRepo.update(
      { collectionKey: k },
      { coverImageUrl: url },
    );
    const refreshed = await this.findOne(k);
    if (!refreshed) {
      throw new Error('COLLECTION_NOT_FOUND');
    }
    this.logger.log(
      `[CoverImg] admin set ${k}: "${url.slice(0, 72)}"`,
    );
    return refreshed;
  }

  /**
   * Admin: resolve best catalog/cover URL from a token's IPFS metadata (Cardhedger / PSA / TCG).
   */
  async adminPreviewCoverFromToken(
    tokenId: string,
    collectionKey?: string,
  ): Promise<string | null> {
    const uri = await this.blockchain.getRwaTokenURI(Number(tokenId));
    const meta = await this.ipfsResolver.fetchMetadataJson(uri);
    let psaSpecFb: string | null = null;
    if (collectionKey?.trim()) {
      const col = await this.findOne(collectionKey);
      psaSpecFb = this.psaSpecIdFromComponentsRow(col?.components);
    }
    return this.resolveBestCoverUrl(meta, psaSpecFb);
  }

  /**
   * Admin-only: remove collection bucket and all marketplace rows keyed by it
   * (snapshots, orders, rwa_tokens registry rows, marketplace_collections).
   */
  async adminDeleteCollectionCompletely(collectionKey: string): Promise<{
    collectionKey: string;
    deletedSnapshots: number;
    deletedOrders: number;
    deletedRwaTokens: number;
    deletedCollection: boolean;
  }> {
    const k = collectionKey.toLowerCase();
    const row = await this.findOne(k);
    if (!row) {
      throw new Error('COLLECTION_NOT_FOUND');
    }

    const result = await this.collectionRepo.manager.transaction(async (em) => {
      const snapRes = await em.delete(CollectionMarketSnapshot, {
        collectionKey: k,
      });
      const orderRes = await em.delete(Order, { collectionKey: k });
      const rwaRes = await em.delete(RwaToken, { collectionKey: k });
      const colRes = await em.delete(MarketplaceCollection, {
        collectionKey: k,
      });
      return {
        deletedSnapshots: snapRes.affected ?? 0,
        deletedOrders: orderRes.affected ?? 0,
        deletedRwaTokens: rwaRes.affected ?? 0,
        deletedCollection: (colRes.affected ?? 0) > 0,
      };
    });

    for (const cacheKey of [...this.merkleSetCache.keys()]) {
      if (cacheKey.startsWith(`${k}:`)) {
        this.merkleSetCache.delete(cacheKey);
      }
    }
    this.representativeImageResolveInflight.delete(k);

    this.logger.warn(
      `[Admin] deleted collection ${k}: snapshots=${result.deletedSnapshots} orders=${result.deletedOrders} rwa_tokens=${result.deletedRwaTokens}`,
    );

    return { collectionKey: k, ...result };
  }

  /**
   * Representative image: persisted `cover_image_url` only.
   * When still empty, pick art from active listings (lowest token id first) and persist once.
   * Never overwrites an existing cover (use admin API to replace).
   *
   * Concurrency: at most one resolution per `collection_key` at a time (parallel page loads share one scrape).
   *
   * @param preloaded — When set (e.g. from `GET /collections/:key`), skips a second DB read for active asks/bids.
   */
  async resolveRepresentativeImageForCollection(
    collectionKey: string,
    preloaded?: { asks: Order[]; bids: Order[] },
  ): Promise<string | null> {
    const k = collectionKey.toLowerCase();
    const inflight = this.representativeImageResolveInflight.get(k);
    if (inflight) return inflight;

    const job = this.runRepresentativeImageResolution(k, preloaded).finally(
      () => {
        this.representativeImageResolveInflight.delete(k);
      },
    );
    this.representativeImageResolveInflight.set(k, job);
    return job;
  }

  private async runRepresentativeImageResolution(
    collectionKey: string,
    preloaded?: { asks: Order[]; bids: Order[] },
  ): Promise<string | null> {
    const k = collectionKey.toLowerCase();
    const col = await this.findOne(k);
    const stored = col?.coverImageUrl?.trim() ?? '';
    const psaSpecFromComp = this.psaSpecIdFromComponentsRow(col?.components);

    if (stored) return stored;

    const asks = preloaded?.asks ?? (await this.activeListingsForCollection(k));
    const bids = preloaded?.bids ?? (await this.activeBidsForCollection(k));
    const askIds = asks
      .map((o) => o.tokenId)
      .filter((id) => id != null && String(id).trim() !== '');
    const bidIds = bids.map((o) => o.tokenId).filter((id) => id && id !== '0');
    const tokenIds = [...new Set([...askIds, ...bidIds])].sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb)
        return na - nb;
      return String(a).localeCompare(String(b), undefined, { numeric: true });
    });

    for (const tokenId of tokenIds) {
      try {
        const uri = await this.blockchain.getRwaTokenURI(Number(tokenId));
        const meta = await this.ipfsResolver.fetchMetadataJson(uri);
        const img = await this.resolveBestCoverUrl(meta, psaSpecFromComp);
        if (!img) continue;

        await this.collectionRepo
          .createQueryBuilder()
          .update(MarketplaceCollection)
          .set({ coverImageUrl: img })
          .where('collection_key = :k', { k })
          .andWhere(
            '(cover_image_url IS NULL OR TRIM(cover_image_url) = \'\')',
          )
          .execute();
        this.logger.log(
          `[CoverImg] resolveRepresentativeImage first cover ${k}: "${img.slice(0, 72)}"`,
        );

        const refreshed = await this.findOne(k);
        return refreshed?.coverImageUrl?.trim() ?? img;
      } catch {
        /* next token */
      }
    }

    return stored || null;
  }

  /**
   * Merkle leaves: every minted RWA whose metadata maps to this collection bucket (not only active asks).
   * Criteria bids stay valid when a new token from the same pool lists — the leaf was already in the tree.
   */
  async merkleEligibleTokenIds(
    collectionKey: string,
    options?: { bypassCache?: boolean },
  ): Promise<{ tokenIds: string[] }> {
    const k = collectionKey.toLowerCase();
    const { totalMinted } = await this.blockchain.getRwaInfo();
    const cacheKey = `${k}:${totalMinted}`;
    const now = Date.now();
    if (!options?.bypassCache) {
      const hit = this.merkleSetCache.get(cacheKey);
      if (hit && hit.expiresAtMs > now) {
        return { tokenIds: hit.tokenIds };
      }
    }

    const tokenIds = await this.scanMintedTokenIdsForCollectionKey(
      k,
      totalMinted,
    );
    this.merkleSetCache.set(cacheKey, {
      tokenIds,
      expiresAtMs: now + CollectionService.MERKLE_SET_CACHE_TTL_MS,
    });
    return { tokenIds };
  }

  private async scanMintedTokenIdsForCollectionKey(
    targetKeyLower: string,
    totalMinted: number,
  ): Promise<string[]> {
    if (totalMinted <= 0) {
      return [];
    }
    /** `TokenableRWA.totalMinted()` = `_nextTokenId` → minted ids are `0 .. totalMinted - 1` (not `1..totalMinted`). */
    const maxId = totalMinted - 1;
    const ids: string[] = [];
    const concurrency = CollectionService.MERKLE_SCAN_CONCURRENCY;
    for (let start = 0; start <= maxId; start += concurrency) {
      const end = Math.min(start + concurrency - 1, maxId);
      const chunk: number[] = [];
      for (let tid = start; tid <= end; tid++) {
        chunk.push(tid);
      }
      const flags = await Promise.all(
        chunk.map((tid) =>
          this.mintedTokenBelongsToCollection(tid, targetKeyLower),
        ),
      );
      for (let i = 0; i < chunk.length; i++) {
        if (flags[i]) ids.push(String(chunk[i]));
      }
    }
    ids.sort((a, b) => {
      const ba = BigInt(a);
      const bb = BigInt(b);
      if (ba < bb) return -1;
      if (ba > bb) return 1;
      return 0;
    });
    return ids;
  }

  private async mintedTokenBelongsToCollection(
    tokenId: number,
    targetKeyLower: string,
  ): Promise<boolean> {
    const max = CollectionService.MERKLE_TOKEN_LOOKUP_ATTEMPTS;
    for (let attempt = 0; attempt < max; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 100 * attempt));
      }
      try {
        const uri = await this.blockchain.getRwaTokenURI(tokenId);
        const meta = await this.ipfsResolver.fetchMetadataJson(uri);
        const comp = extractBucketComponentsFromMetadata(meta);
        if (!comp) return false;
        const key = computeMarketBucketKey(comp);
        return key.toLowerCase() === targetKeyLower;
      } catch {
        /* transient RPC / IPFS — retry */
      }
    }
    return false;
  }
}
