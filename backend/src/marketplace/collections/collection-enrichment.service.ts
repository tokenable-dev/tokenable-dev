import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import { CollectionComponentsService } from './collection-components.service';

/**
 * Snapshot-facing enrichment facade.
 *
 * Exposes only the collection-side operations that
 * {@link CollectionMarketSnapshotService} needs before each snapshot refresh,
 * without importing the full {@link CollectionService} god-object.
 *
 * This service is intentionally a thin pass-through to
 * {@link CollectionComponentsService}; no business logic lives here.
 *
 * Dependency direction: Snapshots → CollectionEnrichmentService → Collections
 * (one-way, no circular dependency)
 *
 * **Correctness model for cardhedgerCardId:**
 * DB is the single source of truth. `findOne` returns whatever is stored in the
 * DB at the time of the call — no cache hydration, no cache dependency.
 *
 * `cardhedgerCardId` is an OPTIMIZATION for the snapshot pipeline (enables a direct
 * `card-details` lookup instead of a full search). When null, `CardhedgerResolveService`
 * falls back to search and produces correct results. Snapshot correctness therefore does
 * NOT depend on identity seed timing, enqueue ordering, or multi-pod cache consistency.
 */
@Injectable()
export class CollectionEnrichmentService {
  constructor(
    @InjectRepository(MarketplaceCollection)
    private readonly collectionRepo: Repository<MarketplaceCollection>,
    private readonly components: CollectionComponentsService,
  ) {}

  async findOne(key: string): Promise<MarketplaceCollection | null> {
    return this.collectionRepo.findOne({
      where: { collectionKey: key.toLowerCase() },
    });
  }

  async refreshPsaPublicSnapshotForCollection(
    collectionKey: string,
    opts?: { allowUpstream?: boolean },
  ): Promise<void> {
    return this.components.refreshPsaPublicSnapshotForCollection(
      collectionKey,
      opts,
    );
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
    return this.components.auditCardhedgerCardIdExact(collectionKey, options);
  }

  async ensureMintParallelVarietyFromListings(
    collectionKey: string,
  ): Promise<boolean> {
    return this.components.ensureMintParallelVarietyFromListings(collectionKey);
  }

  async mergePsaSnapshotIntoComponentsFromDb(
    col: MarketplaceCollection,
  ): Promise<MarketplaceCollection> {
    return this.components.mergePsaSnapshotIntoComponentsFromDb(col);
  }

  async persistPsaMirrorFromCertToDb(collectionKey: string): Promise<boolean> {
    return this.components.persistPsaMirrorFromCertToDb(collectionKey);
  }

  async ensurePsaSpecPopulationFromApi(
    collectionKey: string,
    opts?: { allowUpstream?: boolean },
  ): Promise<void> {
    return this.components.ensurePsaSpecPopulationFromApi(collectionKey, opts);
  }

  /**
   * Back-fill `components.cardhedgerCardId` when a snapshot search resolves a verified match.
   * Fire-and-forget: callers should `void` this call.
   */
  async writeCardhedgerIdFromResolvedSearch(
    collectionKey: string,
    resolvedCardId: string,
    confidence: 'verified' | 'approximate',
    searchQuery?: string | null,
  ): Promise<void> {
    return this.components.writeCardhedgerIdFromResolvedSearch(
      collectionKey,
      resolvedCardId,
      confidence,
      searchQuery,
    );
  }

  /**
   * Back-fill `components.cardhedgerCardId` when resolved via CardHedger's
   * `details-by-certs` (cert-authoritative lookup). Fire-and-forget.
   */
  async writeCardhedgerIdFromCertLookup(
    collectionKey: string,
    certCardId: string,
    searchQuery?: string | null,
  ): Promise<void> {
    return this.components.writeCardhedgerIdFromCertLookup(
      collectionKey,
      certCardId,
      searchQuery,
    );
  }

  /**
   * Store a CardHedger `cert_info.description` as `cardhedgerSearchQuery` when
   * cert lookup returned `card: null`. Fire-and-forget.
   */
  async writeCardhedgerSearchQueryFromCert(
    collectionKey: string,
    description: string,
  ): Promise<void> {
    return this.components.writeCardhedgerSearchQueryFromCert(
      collectionKey,
      description,
    );
  }
}
