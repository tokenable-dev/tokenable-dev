import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryDeepPartialEntity, Repository } from 'typeorm';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { IpfsGatewayResolverService } from '../../blockchain/ipfs-gateway-resolver.service';
import { CardhedgerService } from '../../cardhedger/cardhedger.service';
import {
  normalizePsaSpecId,
  PsaPublicApiService,
  specIdStringFromPsaCertBody,
} from '../../psa/psa-public-api.service';
import {
  hasCompletePsaPopulationByGrade,
  PSA_GRADE_KEYS,
  psaPopulationByGradeRecord,
} from '../../psa/psa-spec-population.util';
import { mergePsaVarietyWithMintVariant } from '../../psa/psa-variety-catalog.util';
import { extractBucketComponentsFromMetadata } from '../utils/bucket-key.util';
import { marketParallelKeyFromPsaVariety } from '../utils/market-parallel-key.util';
import { pickTrendingSlabImageRef, psaCertNumberFromGradedMeta } from '../utils/collection-image.util';
import { psaCertNumberFromCollectionRow } from '../utils/collection-row.util';
import {
  componentsPsaMirrorSufficientForCardhedger,
  mergePsaCertSnapshotIntoMirror,
} from '../utils/psa-components-mirror.util';
import {
  cardIdFromPsaCertLookup,
  CARDHEDGER_CARD_ID_SOURCE_PSA_CERT,
  catalogRowTrustedForMarketData,
} from '../utils/card-match.util';
import { Order, OrderSide, OrderStatus } from '../entities/order.entity';
import { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import { PsaCertSnapshotService } from './psa-cert-snapshot.service';
import {
  cardhedgerFromRwaMetadata,
  extractListingDisplayTitleFromMeta,
  mintVariantFromGradedMeta,
  psaSpecIdFromComponentsRow,
} from './collection-listing-meta.helpers';
import { CollectionIdentityService } from './collection-identity.service';

/** PSA/Cardhedger/listing component enrichment from IPFS metadata and active orders. */
@Injectable()
export class CollectionComponentsService {
  private readonly logger = new Logger(CollectionComponentsService.name);

  constructor(
    @InjectRepository(MarketplaceCollection)
    private readonly collectionRepo: Repository<MarketplaceCollection>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly blockchain: BlockchainService,
    private readonly config: ConfigService,
    private readonly cardhedger: CardhedgerService,
    private readonly ipfsResolver: IpfsGatewayResolverService,
    private readonly psaCertSnapshots: PsaCertSnapshotService,
    private readonly psaPublicApi: PsaPublicApiService,
    private readonly identity: CollectionIdentityService,
  ) {}

  private collectionActiveOrdersCap(): number {
    return this.config.get<number>('marketplace.collectionActiveOrdersMax') ?? 2_000;
  }

  private async activeListingsForCollection(collectionKey: string): Promise<Order[]> {
    return this.orderRepo.find({
      where: {
        collectionKey: collectionKey.toLowerCase(),
        status: OrderStatus.ACTIVE,
        side: OrderSide.ASK,
      },
      order: { createdAt: 'ASC' },
      take: this.collectionActiveOrdersCap(),
    });
  }

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
        const cv = mintVariantFromGradedMeta(meta);
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
  async mergePsaPopulationFromMetaIfMissing(
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

  async mergeTrendingSlabMetaFromMetaIfMissing(
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
   * Persist `components.psaSpecId` from mint metadata or PSA Public API cert lookup.
   */
  async mergePsaSpecIdFromCertIfMissing(
    collectionKey: string,
    psaCert: string | undefined,
    meta: Record<string, unknown>,
  ): Promise<void> {
    const key = collectionKey.toLowerCase();
    const row = await this.collectionRepo.findOne({
      where: { collectionKey: key },
    });
    if (!row) return;
    if (psaSpecIdFromComponentsRow(row.components)) return;

    let specId = cardhedgerFromRwaMetadata(meta).psaSpecId;
    const cert = psaCert?.trim() || row.psaCertNumber?.trim() || '';
    if (!specId && cert) {
      try {
        const snap = await this.psaCertSnapshots.fetchCertSnapshotJson(cert, {
          allowUpstream: false,
        });
        specId =
          snap != null
            ? specIdStringFromPsaCertBody({ PSACert: snap }) ?? null
            : null;
      } catch {
        /* retry on cover schedule */
      }
    }
    if (!specId) return;

    const next = { ...row.components, psaSpecId: specId };
    await this.collectionRepo.update(
      { collectionKey: key },
      {
        components: next as QueryDeepPartialEntity<Record<string, unknown>>,
      },
    );
  }

  /**
   * Fetches PSA spec pop report (Grade1–10 + Total) when missing from components.
   * Uses PSA Public API `/pop/GetPSASpecPopulation/{specID}` only when `allowUpstream`.
   */
  async ensurePsaSpecPopulationFromApi(
    collectionKey: string,
    opts?: { allowUpstream?: boolean },
  ): Promise<void> {
    const allowUpstream = opts?.allowUpstream === true;
    const k = collectionKey.toLowerCase();
    const row = await this.collectionRepo.findOne({
      where: { collectionKey: k },
    });
    if (!row) return;
    const comp = row.components;
    const hasFullByGrade = hasCompletePsaPopulationByGrade(
      comp as Record<string, unknown>,
    );
    const hasTotal =
      typeof comp.psaSpecTotalPopulation === 'number' &&
      Number.isFinite(comp.psaSpecTotalPopulation) &&
      comp.psaSpecTotalPopulation >= 0;
    if (hasFullByGrade && hasTotal) return;

    let specId = psaSpecIdFromComponentsRow(comp);
    if (!specId) {
      const cert = psaCertNumberFromCollectionRow(row);
      if (cert) {
        const snap = await this.psaCertSnapshots.fetchCertSnapshotJson(cert, {
          allowUpstream,
        });
        specId = normalizePsaSpecId(snap?.SpecID);
      }
    }
    if (!specId) {
      const asks = await this.activeListingsForCollection(k);
      for (const o of asks) {
        if (!o.tokenId || String(o.tokenId).trim() === '') continue;
        try {
          const uri = await this.blockchain.getRwaTokenURI(Number(o.tokenId));
          const meta = await this.ipfsResolver.fetchMetadataJson(uri);
          const fromMeta = cardhedgerFromRwaMetadata(meta).psaSpecId;
          if (fromMeta) {
            specId = fromMeta;
            break;
          }
        } catch {
          /* try next listing */
        }
      }
    }
    if (!specId) return;

    if (!allowUpstream) return;

    const lookup = await this.psaPublicApi.getSpecPopulation(specId);
    if (lookup.status !== 'success') {
      if (lookup.status === 'error') {
        this.logger.debug(
          `PSA spec pop lookup failed collection=${k} specId=${specId}: ${lookup.message}`,
        );
      }
      return;
    }

    const { grade10, total, byGrade } = lookup.pop;
    const next: Record<string, unknown> = { ...comp };
    let dirty = false;

    const byGradeRecord = psaPopulationByGradeRecord(byGrade);
    if (byGradeRecord) {
      const prev = comp.psaPopulationByGrade;
      const changed =
        !prev ||
        typeof prev !== 'object' ||
        PSA_GRADE_KEYS.some(
          (key) =>
            (prev as Record<string, unknown>)[key] !== byGradeRecord[key],
        );
      if (changed) {
        next.psaPopulationByGrade = byGradeRecord;
        dirty = true;
      }
    } else {
      this.logger.debug(
        `PSA spec pop incomplete grade breakdown collection=${k} specId=${lookup.specId}`,
      );
    }

    if (grade10 != null && grade10 >= 0) {
      if (comp.psaGrade10Population !== grade10) {
        next.psaGrade10Population = grade10;
        dirty = true;
      }
    }
    if (total != null && total >= 0) {
      if (comp.psaSpecTotalPopulation !== total) {
        next.psaSpecTotalPopulation = total;
        dirty = true;
      }
    }
    if (
      grade10 != null &&
      grade10 > 0 &&
      (typeof comp.psaTotalPopulation !== 'number' ||
        comp.psaTotalPopulation <= 0)
    ) {
      next.psaTotalPopulation = grade10;
      dirty = true;
    }
    if (!comp.psaSpecId && lookup.specId) {
      next.psaSpecId = lookup.specId;
      dirty = true;
    }

    if (!dirty) return;
    await this.collectionRepo.update(
      { collectionKey: k },
      { components: next as QueryDeepPartialEntity<Record<string, unknown>> },
    );
  }

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
   *
   * When `IDENTITY_SERVICE_ENABLED=true`, the consensual ID from active listings is
   * persisted through `CollectionIdentityService.writeFromMintMetadata` (mint precedence).
   * Legacy direct-write path remains active when the flag is off.
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
    let lastMeta: Record<string, unknown> | null = null;
    for (const o of asks) {
      if (!o.tokenId || String(o.tokenId).trim() === '') continue;
      try {
        const uri = await this.blockchain.getRwaTokenURI(Number(o.tokenId));
        const meta = await this.ipfsResolver.fetchMetadataJson(uri);
        const ch = cardhedgerFromRwaMetadata(meta);
        if (ch.cardId) {
          ids.add(ch.cardId);
          lastMeta = meta;
        }
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

    // When identity service is enabled, delegate to the canonical write path.
    if (this.identity.isEnabled() && lastMeta) {
      await this.identity.writeFromMintMetadata(k, lastMeta);
      return true;
    }

    // Legacy direct-write path (flag disabled).
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
  async ensurePsaCertNumberFromListings(
    collectionKey: string,
    opts?: { schedulePsaRefresh?: boolean },
  ): Promise<void> {
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
    if (opts?.schedulePsaRefresh === true) {
      this.psaCertSnapshots.scheduleRefreshIfNeeded(only, 'cert_column_update');
    }
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

    await this.psaCertSnapshots.refreshIfStale(cert, { allowUpstream: false });
  }

  async mergePsaSnapshotIntoComponentsFromDb(
    col: MarketplaceCollection,
  ): Promise<MarketplaceCollection> {
    const cert = psaCertNumberFromCollectionRow(col);
    if (!cert) return col;
    const snap = await this.psaCertSnapshots.getSnapshotJsonIfFresh(cert);
    return this.mergePsaSnapshotIntoComponents(col, snap);
  }

  /** Persist PSA cert mirror fields onto `marketplace_collections` before cardhedger audit. */
  async persistPsaMirrorFromCertToDb(collectionKey: string): Promise<boolean> {
    const k = collectionKey.toLowerCase();
    const row = await this.collectionRepo.findOne({
      where: { collectionKey: k },
    });
    if (!row) return false;
    const merged = await this.mergePsaSnapshotIntoComponentsFromDb(row);
    const compBefore = JSON.stringify(row.components);
    const compAfter = JSON.stringify(merged.components);
    const parallelChanged =
      String(row.marketParallelKey ?? '').toLowerCase() !==
      String(merged.marketParallelKey ?? '').toLowerCase();
    if (compBefore === compAfter && !parallelChanged) return false;
    await this.collectionRepo.update(
      { collectionKey: k },
      {
        components: merged.components as QueryDeepPartialEntity<
          Record<string, unknown>
        >,
        marketParallelKey: merged.marketParallelKey,
      },
    );
    return true;
  }

  /**
   * Back-fill `components.cardhedgerCardId` when a snapshot search resolves a verified match.
   * Only writes when `components.cardhedgerCardId` is currently empty (delegates to
   * `CollectionIdentityService.writeFromResolvedSearch`, which is a no-op when an id is
   * already stored or when confidence is below `verified`).
   */
  async writeCardhedgerIdFromResolvedSearch(
    collectionKey: string,
    resolvedCardId: string,
    confidence: 'verified' | 'approximate',
    searchQuery?: string | null,
  ): Promise<void> {
    return this.identity.writeFromResolvedSearch(
      collectionKey,
      resolvedCardId,
      confidence,
      searchQuery,
    );
  }

  /**
   * Back-fill `components.cardhedgerCardId` from a cert-authoritative lookup
   * (`POST /v1/cards/details-by-certs`). Delegates to `writeFromCertLookup`
   * which is a conditional first-write (no-op when ID already stored).
   */
  async writeCardhedgerIdFromCertLookup(
    collectionKey: string,
    certCardId: string,
    searchQuery?: string | null,
  ): Promise<void> {
    if (this.identity.isEnabled()) {
      await this.identity.writeFromCertLookup(
        collectionKey,
        certCardId,
        searchQuery,
      );
      return;
    }
    const k = collectionKey.toLowerCase();
    const row = await this.collectionRepo.findOne({
      where: { collectionKey: k },
    });
    if (!row) return;
    const comp = (row.components ?? {}) as Record<string, unknown>;
    if (String(comp.cardhedgerCardId ?? '').trim()) return;
    const next: Record<string, unknown> = {
      ...comp,
      cardhedgerCardId: certCardId.trim(),
      cardhedgerCardIdSource: CARDHEDGER_CARD_ID_SOURCE_PSA_CERT,
    };
    if (searchQuery?.trim()) {
      next.cardhedgerSearchQuery = searchQuery.trim();
    }
    await this.collectionRepo.update(
      { collectionKey: k },
      { components: next as QueryDeepPartialEntity<Record<string, unknown>> },
    );
  }

  /**
   * Store a CardHedger-formatted search query from `cert_info.description` when
   * `card: null`. Enables the text-search path to use a high-quality query on
   * the next snapshot refresh.
   */
  async writeCardhedgerSearchQueryFromCert(
    collectionKey: string,
    description: string,
  ): Promise<void> {
    return this.identity.writeSearchQueryFromCert(collectionKey, description);
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
    if (cardIdFromPsaCertLookup(comp)) {
      return { checked: true, ok: true, cleared: false, failCodes: [] };
    }
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
    const psaSubject =
      typeof comp.psaSubject === 'string' ? comp.psaSubject.trim() : '';
    const psaBrand =
      typeof comp.psaBrand === 'string' ? comp.psaBrand.trim() : '';
    const ex = catalogRowTrustedForMarketData(
      {
        cardName: wantName,
        cardNumber: wantNum,
        cardSet: wantSet,
        psaSubject: psaSubject || undefined,
        psaBrand: psaBrand || undefined,
        psaYear:
          typeof comp.psaYear === 'string'
            ? comp.psaYear.trim()
            : typeof comp.psaYear === 'number' && Number.isFinite(comp.psaYear)
              ? String(Math.floor(comp.psaYear))
              : undefined,
        cardhedgerSearchQuery:
          typeof comp.cardhedgerSearchQuery === 'string'
            ? comp.cardhedgerSearchQuery.trim()
            : undefined,
        listingDisplayTitle:
          typeof comp.listingDisplayTitle === 'string'
            ? comp.listingDisplayTitle.trim()
            : undefined,
      },
      {
        name: String(row.description ?? row.name ?? ''),
        cardNumber: String(row.number ?? ''),
        set: { name: String(row.set ?? '') },
      },
    );
    if (ex.ok) {
      const successResult = { checked: true, ok: true, cleared: false, failCodes: [] };
      if (this.identity.isEnabled()) {
        this.identity.logAuditDecision(k, successResult);
      }
      return successResult;
    }

    if (options?.clearOnMismatch) {
      const { cleared } = await this.identity.clearCardhedgerCardIdIfUnchanged(
        k,
        cardId,
      );
      const clearedResult = {
        checked: true,
        ok: false,
        cleared,
        failCodes: ex.failCodes,
      };
      if (this.identity.isEnabled()) {
        this.identity.logAuditDecision(k, clearedResult);
      }
      return clearedResult;
    }
    const result = {
      checked: true,
      ok: false,
      cleared: false,
      failCodes: ex.failCodes,
    };
    // Forward audit outcome to identity service for unified logging (no behaviour change).
    if (this.identity.isEnabled()) {
      this.identity.logAuditDecision(k, result);
    }
    return result;
  }

  async auditStaleCardhedgerCardIdsOnBoot(): Promise<void> {
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

  /**
   * Duplicate-key race: fill `cardhedgerCardId` + `cardhedgerSearchQuery` when the
   * row was created by another listing and its metadata had these fields.
   *
   * When `IDENTITY_SERVICE_ENABLED=true`, delegates to
   * `CollectionIdentityService.writeFromMintMetadata` (canonical write path).
   * Legacy direct-write path remains active when the flag is off.
   */
  async mergeCardhedgerCardIdFromMetaIfMissing(
    collectionKey: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    if (this.identity.isEnabled()) {
      await this.identity.writeFromMintMetadata(collectionKey, meta);
      return;
    }

    // Legacy direct-write path (flag disabled).
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
    const ch = cardhedgerFromRwaMetadata(meta);
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
  async mergeListingDisplayTitleFromMetaIfMissing(
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
    const t = extractListingDisplayTitleFromMeta(meta);
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
        const t = extractListingDisplayTitleFromMeta(meta);
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
}
