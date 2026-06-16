import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Contract } from 'ethers';
import { TOKENABLE_RWA_CONTRACT } from '../../blockchain/constants/injection-tokens';
import { CardhedgerMarketDataService } from '../market-data/cardhedger-market-data.service';
import { CollectionIdentityService } from './collection-identity.service';
import { CollectionCoverService } from './collection-cover.service';
import { CollectionService } from './collection.service';
import { RwaTokenRegistryService } from './rwa-token-registry.service';

/**
 * Listens to the on-chain `Minted(address to, uint256 tokenId, string tokenURI)` event.
 * When a new token is minted, automatically:
 *   1. Creates/ensures the marketplace_collections row
 *   2. Resolves cardhedgerCardId via PSA cert → Cardhedger API
 *   3. Re-enqueues market snapshot refresh once cardId is known
 *   4. Triggers cover image resolution
 *
 * Enable via env:  MINT_EVENT_LISTENER_ENABLED=1
 */
@Injectable()
export class MintEventListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MintEventListenerService.name);
  private listening = false;

  constructor(
    @Inject(TOKENABLE_RWA_CONTRACT)
    private readonly contract: Contract,
    private readonly collectionService: CollectionService,
    private readonly rwaTokenRegistry: RwaTokenRegistryService,
    private readonly cardhedgerMarket: CardhedgerMarketDataService,
    private readonly identity: CollectionIdentityService,
    private readonly cover: CollectionCoverService,
    private readonly eventEmitter: EventEmitter2,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const enabled =
      this.config.get<string>('MINT_EVENT_LISTENER_ENABLED') === '1' ||
      this.config.get<string>('MINT_EVENT_LISTENER_ENABLED') === 'true';
    if (!enabled) {
      this.logger.log(
        'MintEventListenerService disabled (set MINT_EVENT_LISTENER_ENABLED=1 to enable)',
      );
      return;
    }

    setImmediate(() => void this.startListening());
  }

  async onModuleDestroy(): Promise<void> {
    if (this.listening) {
      try {
        await this.contract.removeAllListeners('Minted');
        this.listening = false;
        this.logger.log('MintEventListenerService: removed Minted listener');
      } catch (e) {
        this.logger.warn(`removeAllListeners error: ${String(e)}`);
      }
    }
  }

  private async startListening(): Promise<void> {
    try {
      await this.contract.on(
        'Minted',
        (to: string, tokenId: bigint, tokenURI: string) => {
          const id = Number(tokenId);
          this.logger.log(
            `Minted event: tokenId=${id} to=${to} uri=${tokenURI.slice(0, 80)}`,
          );
          void this.handleMintedToken(id).catch((err: unknown) => {
            this.logger.warn(
              `handleMintedToken failed for #${id}: ${String(err)}`,
            );
          });
        },
      );
      this.listening = true;
      this.logger.log('MintEventListenerService: listening for Minted events');
    } catch (e) {
      this.logger.error(
        `MintEventListenerService failed to attach listener: ${String(e)}`,
      );
    }
  }

  /**
   * Core handler: bootstraps the full marketplace collection pipeline for a newly minted token.
   *
   * Steps:
   *   1. Create marketplace_collections row (idempotent)
   *   2. Sync rwa_tokens registry
   *   3. Resolve cardhedgerCardId via PSA cert → Cardhedger API and persist
   *   4. Re-enqueue market snapshot refresh (now with cardId available)
   *   5. Trigger cover image resolution (using cert snapshot result)
   *
   * Called from the on-chain event listener AND from POST /collections/on-mint.
   */
  async handleMintedToken(tokenId: number): Promise<void> {
    const id = Math.floor(tokenId);
    if (!Number.isFinite(id) || id < 0) return;

    // ── Step 1: Ensure marketplace_collections row ─────────────────────────
    const collectionKey = await this.collectionService.ensureCollectionForListing(
      String(id),
    );

    // ── Step 2: Sync rwa_tokens ────────────────────────────────────────────
    await this.rwaTokenRegistry.syncTokenFromChain(id, collectionKey);

    if (!collectionKey) {
      this.logger.warn(
        `MintEventListenerService: no collectionKey for #${id} — graded metadata missing?`,
      );
      return;
    }

    this.logger.log(
      `MintEventListenerService: token #${id} collection=${collectionKey}`,
    );

    // ── Step 3: Resolve cardhedgerCardId from PSA cert ─────────────────────
    // ensureCollectionForListing already schedules PSA cert snapshot refresh.
    // We now proactively look up the cert via Cardhedger API so the card ID is
    // available for the comps fetch even before the first listing.
    await this.resolveAndPersistCardhedgerCardId(id, collectionKey);

    // ── Step 4: Re-enqueue snapshot refresh now that cardId may be set ─────
    // The first enqueue inside ensureCollectionForListing ran before cardId was
    // known. Re-fire so the snapshot pipeline uses the newly written cardId.
    this.eventEmitter.emit('snapshot.enqueue', {
      key: collectionKey,
      reason: 'cold_start',
    });

    // ── Step 5: Cover image — retry after cert/spec enrichment ─────────────
    // PSA spec pages may require Collectors login; fallbacks (Public API slab,
    // Cardhedger catalog) run inside CollectionCoverService.
    for (const delayMs of [8_000, 25_000]) {
      setTimeout(() => {
        void this.retryResolveCoverFromToken(id, collectionKey).catch(
          (e: unknown) => {
            this.logger.warn(
              `cover retry failed for #${id} (delay=${delayMs}ms): ${String(e)}`,
            );
          },
        );
      }, delayMs);
    }
  }

  /**
   * Looks up cardhedgerCardId via `POST /v1/cards/details-by-certs` using the
   * token's PSA cert number and persists the result to the collection components.
   *
   * When the identity service is enabled this delegates to `writeFromCertLookup`
   * (precedence-safe). When disabled, writes directly via collection update.
   */
  private async resolveAndPersistCardhedgerCardId(
    tokenId: number,
    collectionKey: string,
  ): Promise<void> {
    try {
      const col = await this.collectionService.findOne(collectionKey);
      if (!col) return;

      // Already set — nothing to do.
      const existing =
        typeof col.components?.cardhedgerCardId === 'string'
          ? col.components.cardhedgerCardId.trim()
          : '';
      if (existing) return;

      // Get PSA cert number from the collection row (populated by ensureCollectionForListing).
      const certRaw = col.psaCertNumber?.trim();
      if (!certRaw) {
        this.logger.debug(
          `mint-bootstrap #${tokenId}: no psaCertNumber on collection — skipping cardId cert lookup`,
        );
        return;
      }

      const resolved = await this.cardhedgerMarket.tryResolveCardIdByCert(certRaw);
      if (!resolved) {
        this.logger.debug(
          `mint-bootstrap #${tokenId}: cert ${certRaw} unknown to Cardhedger`,
        );
        return;
      }

      if (resolved.cardId) {
        if (this.identity.isEnabled()) {
          await this.identity.writeFromCertLookup(
            collectionKey,
            resolved.cardId,
            resolved.query,
          );
        } else {
          // Legacy direct-write path (identity service disabled).
          await this.collectionService.mergeComponentsForMintBootstrap(
            collectionKey,
            {
              cardhedgerCardId: resolved.cardId,
              ...(resolved.query
                ? { cardhedgerSearchQuery: resolved.query }
                : {}),
            },
          );
        }
        this.logger.log(
          `mint-bootstrap #${tokenId}: cardId=${resolved.cardId} resolved from cert ${certRaw}`,
        );
      } else if (resolved.certDescription) {
        // Cardhedger knows the cert but has no card_id — persist the description
        // as a search query so text-search can find the right row.
        if (this.identity.isEnabled()) {
          await this.identity.writeSearchQueryFromCert(
            collectionKey,
            resolved.certDescription,
          );
        } else {
          await this.collectionService.mergeComponentsForMintBootstrap(
            collectionKey,
            { cardhedgerSearchQuery: resolved.certDescription },
          );
        }
        this.logger.log(
          `mint-bootstrap #${tokenId}: cert ${certRaw} → searchQuery="${resolved.certDescription.slice(0, 80)}"`,
        );
      }
    } catch (e: unknown) {
      this.logger.warn(
        `mint-bootstrap #${tokenId} cert-lookup failed: ${String(e)}`,
      );
    }
  }

  /**
   * Re-attempts cover image resolution after the PSA cert snapshot has had a
   * chance to be fetched.  Only runs if the cover is still empty.
   */
  private async retryResolveCoverFromToken(
    tokenId: number,
    collectionKey: string,
  ): Promise<void> {
    const col = await this.collectionService.findOne(collectionKey);
    if (!col) return;
    if (
      col.coverImageUrl?.trim() &&
      !this.cover.coverImageNeedsUpgrade(col.coverImageUrl)
    ) {
      return;
    }

    // Populate components.psaSpecId from PSA cert snapshot / Public API.
    await this.collectionService.ensurePsaSpecPopulationFromApi(collectionKey);

    const asset = await this.collectionService.resolveAssetForCoverRetry(tokenId);
    if (!asset?.meta) return;

    await this.cover.persistCoverFromMetaIfMissing(collectionKey, asset.meta);

    const after = await this.collectionService.findOne(collectionKey);
    if (after?.coverImageUrl?.trim()) {
      this.logger.log(
        `mint-bootstrap #${tokenId}: cover set for ${collectionKey} → ${after.coverImageUrl.slice(0, 80)}`,
      );
    } else {
      this.logger.debug(
        `mint-bootstrap #${tokenId}: cover still empty for ${collectionKey} after retry`,
      );
    }
  }
}
