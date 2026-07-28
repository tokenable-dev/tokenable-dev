import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryDeepPartialEntity, Repository } from 'typeorm';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { IpfsGatewayResolverService } from '../../blockchain/ipfs-gateway-resolver.service';
import { CardhedgerService } from '../../cardhedger/cardhedger.service';
import {
  normalizeImageUrl,
  pickPreferredCollectionCoverUrl,
  scoreCollectionCoverUrl,
} from '../utils/collection-image.util';
import { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import {
  CatalogCoverS3Service,
  catalogCoverObjectKeyFromPublicUrl,
  normalizeCatalogCoverPublicUrl,
} from './catalog-cover-s3.service';

/** Collection covers: Cardhedger / TCG / our catalog S3 HTTPS URLs. */
function isPersistableCoverUrl(url: string): boolean {
  const t = url.trim();
  if (!/^https?:\/\//i.test(t)) return false;
  if (t.toLowerCase().includes('/ipfs/')) return false;
  if (t.includes('d1htnxwo4o0jhw.cloudfront.net/cert/')) return false;
  return true;
}

function pushCandidate(out: string[], url: string | null | undefined): void {
  if (typeof url !== 'string' || !url.trim()) return;
  const n = normalizeImageUrl(url);
  if (!isPersistableCoverUrl(n)) return;
  out.push(n);
}

/**
 * Collection cover: Cardhedger / TCG → catalog S3 (when configured).
 * Set at collection create; upgraded when a higher-scoring catalog URL is resolved.
 */
@Injectable()
export class CollectionCoverService {
  private readonly logger = new Logger(CollectionCoverService.name);

  constructor(
    @InjectRepository(MarketplaceCollection)
    private readonly collectionRepo: Repository<MarketplaceCollection>,
    private readonly blockchain: BlockchainService,
    private readonly cardhedger: CardhedgerService,
    private readonly ipfsResolver: IpfsGatewayResolverService,
    private readonly catalogCoverS3: CatalogCoverS3Service,
  ) {}

  /** Resolve a persistable cover URL from RWA metadata (no DB write, no S3). */
  async resolveCoverUrlFromMeta(
    meta: Record<string, unknown>,
  ): Promise<string | null> {
    const img = await this.resolveCatalogImageFromMeta(meta);
    if (!img || !isPersistableCoverUrl(img)) return null;
    return img;
  }

  /**
   * Resolve Cardhedger/TCG image for a new collection, download it, and store
   * on catalog S3. Falls back to the remote URL when S3 is not configured or
   * ingest fails (listing must not block).
   */
  async resolveCoverUrlForNewCollection(
    collectionKey: string,
    meta: Record<string, unknown>,
  ): Promise<string | null> {
    const remote = await this.resolveCoverUrlFromMeta(meta);
    if (!remote) return null;
    if (!this.catalogCoverS3.isConfigured()) return remote;

    try {
      const { publicUrl } = await this.catalogCoverS3.ingestRemoteImage(
        collectionKey,
        remote,
      );
      return publicUrl;
    } catch (e) {
      this.logger.warn(
        `Catalog cover S3 ingest on create failed for ${collectionKey}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      return remote;
    }
  }

  /**
   * Persist cover when missing, or replace when the newly resolved URL scores higher.
   * Used on subsequent listings so Bubble thumbs can upgrade to Pokémon TCG large, etc.
   */
  async upgradeCoverFromMetaIfBetter(
    collectionKey: string,
    meta: Record<string, unknown>,
  ): Promise<string | null> {
    const next = await this.resolveCoverUrlFromMeta(meta);
    if (!next) return null;

    const k = collectionKey.toLowerCase();
    const row = await this.findOne(k);
    if (!row) return null;

    const current = row.coverImageUrl?.trim() ?? '';
    if (!current) {
      return this.persistCoverImageUrl(k, next);
    }
    if (scoreCollectionCoverUrl(next) > scoreCollectionCoverUrl(current)) {
      return this.persistCoverImageUrl(k, next);
    }
    return current;
  }

  async setCollectionCoverImageAdmin(
    collectionKey: string,
    coverImageUrl: string,
  ): Promise<MarketplaceCollection> {
    const k = collectionKey.toLowerCase();
    const url = coverImageUrl.trim();
    if (!url) throw new Error('COLLECTION_COVER_URL_EMPTY');
    if (!isPersistableCoverUrl(url)) throw new Error('COLLECTION_COVER_URL_INVALID');

    const row = await this.findOne(k);
    if (!row) throw new Error('COLLECTION_NOT_FOUND');

    const previousCover = row.coverImageUrl;
    let urlToPersist = url;

    if (this.catalogCoverS3.isConfigured()) {
      const alreadyOurs = catalogCoverObjectKeyFromPublicUrl(
        url,
        this.catalogCoverS3.getPublicBaseUrl(),
      );
      if (!alreadyOurs) {
        // External URL → download and overwrite the stable S3 object.
        const { publicUrl } = await this.catalogCoverS3.ingestRemoteImage(k, url);
        urlToPersist = publicUrl;
      }
    }

    const persisted = await this.persistCoverImageUrl(k, urlToPersist);
    if (!persisted) throw new Error('COLLECTION_COVER_URL_INVALID');

    // Clean legacy uuid-style keys when the public URL path changed.
    if (
      previousCover &&
      previousCover.trim() !== urlToPersist &&
      catalogCoverObjectKeyFromPublicUrl(
        previousCover,
        this.catalogCoverS3.getPublicBaseUrl(),
      )
    ) {
      await this.catalogCoverS3.tryDeletePublicCoverUrl(previousCover);
    }

    const refreshed = await this.findOne(k);
    if (!refreshed) throw new Error('COLLECTION_NOT_FOUND');
    return refreshed;
  }

  /**
   * Upload a local image, overwriting the collection's stable S3 cover object.
   */
  async uploadCollectionCoverImageAdmin(
    collectionKey: string,
    file: Express.Multer.File,
  ): Promise<MarketplaceCollection> {
    const k = collectionKey.toLowerCase();
    const row = await this.findOne(k);
    if (!row) throw new Error('COLLECTION_NOT_FOUND');

    const previousCover = row.coverImageUrl;
    const { publicUrl } = await this.catalogCoverS3.uploadCollectionCover(k, file);
    const persisted = await this.persistCoverImageUrl(k, publicUrl);
    if (!persisted) throw new Error('COLLECTION_COVER_URL_INVALID');

    if (
      previousCover &&
      previousCover.trim() !== publicUrl &&
      catalogCoverObjectKeyFromPublicUrl(
        previousCover,
        this.catalogCoverS3.getPublicBaseUrl(),
      )
    ) {
      await this.catalogCoverS3.tryDeletePublicCoverUrl(previousCover);
    }

    const refreshed = await this.findOne(k);
    if (!refreshed) throw new Error('COLLECTION_NOT_FOUND');
    return refreshed;
  }

  async adminPreviewCoverFromToken(
    tokenId: string,
    _collectionKey?: string,
  ): Promise<string | null> {
    const meta = await this.loadTokenMeta(Number(tokenId));
    if (!meta) return null;
    return this.resolveCoverUrlFromMeta(meta);
  }

  /** Admin / ops: re-resolve from token meta and persist only if score improves. */
  async upgradeCoverFromToken(
    collectionKey: string,
    tokenId: string,
  ): Promise<{ coverImageUrl: string | null; upgraded: boolean }> {
    const k = collectionKey.toLowerCase();
    const row = await this.findOne(k);
    if (!row) throw new Error('COLLECTION_NOT_FOUND');
    const prev = row.coverImageUrl?.trim() ?? '';

    const meta = await this.loadTokenMeta(Number(tokenId));
    if (!meta) {
      return { coverImageUrl: prev || null, upgraded: false };
    }

    const after = await this.upgradeCoverFromMetaIfBetter(k, meta);
    const next = after?.trim() ?? prev;
    return {
      coverImageUrl: next || null,
      upgraded: Boolean(next && next !== prev),
    };
  }

  private async findOne(key: string): Promise<MarketplaceCollection | null> {
    return this.collectionRepo.findOne({
      where: { collectionKey: key.toLowerCase() },
    });
  }

  private async loadTokenMeta(tokenId: number): Promise<Record<string, unknown> | null> {
    try {
      const uri = await this.blockchain.getRwaTokenURI(tokenId);
      return await this.ipfsResolver.fetchMetadataJson(uri);
    } catch {
      return null;
    }
  }

  /**
   * Gather catalog candidates (Cardhedger + Pokémon TCG when applicable) and pick
   * the highest-scoring URL. Does not early-return on the first Cardhedger image —
   * `/resize` may or may not be present and is only a demotion signal.
   */
  private async resolveCatalogImageFromMeta(
    meta: Record<string, unknown>,
  ): Promise<string | null> {
    const candidates: string[] = [];

    const props = meta.properties as Record<string, unknown> | undefined;
    const graded = (props?.graded ?? meta.graded) as
      | Record<string, unknown>
      | undefined;
    const ch = graded?.cardhedger as Record<string, unknown> | undefined;
    const cardMeta = graded?.card as Record<string, unknown> | undefined;
    const psaMeta = graded?.psa as Record<string, unknown> | undefined;

    const cardId = typeof ch?.cardId === 'string' ? ch.cardId.trim() : '';
    const chImageUrl =
      typeof ch?.imageUrl === 'string' ? ch.imageUrl.trim() : '';
    pushCandidate(candidates, chImageUrl);

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

    if (cardId) {
      try {
        this.cardhedger.assertConfigured();
        const body = await this.cardhedger.forwardJson(
          'POST',
          '/v1/cards/card-details',
          { body: { card_id: cardId } },
        );
        const cards = (body as { cards?: unknown[] }).cards;
        if (Array.isArray(cards) && cards.length > 0) {
          const row = cards[0] as Record<string, unknown>;
          const rawImg =
            typeof row.image === 'string' && row.image.trim()
              ? row.image.trim()
              : null;
          pushCandidate(candidates, rawImg);
        }
      } catch {
        /* fall through */
      }
    }

    if (cardName) {
      try {
        this.cardhedger.assertConfigured();
        const parts = [cardName, cardNumber, setName, year].filter(Boolean);
        const body = await this.cardhedger.forwardJson(
          'POST',
          '/v1/cards/card-search',
          { body: { search: parts.join(' '), page: 1, page_size: 10 } },
        );
        const cards = Array.isArray((body as { cards?: unknown[] })?.cards)
          ? ((body as { cards: unknown[] }).cards ?? [])
          : [];

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
          const rowNum = normNum(String(row.number ?? ''));
          const rowDesc = normStr(String(row.description ?? row.name ?? ''));
          const rowSet = normStr(String(row.set ?? ''));
          const numOk = !wantNum || rowNum === wantNum;
          const nameOk =
            wantNameWords.length === 0 ||
            wantNameWords.every((w) => rowDesc.includes(w));
          const setOk =
            !wantSet || rowSet.includes(wantSet) || wantSet.includes(rowSet);
          if (numOk && (nameOk || setOk)) {
            pushCandidate(candidates, rawImg);
            break;
          }
        }
      } catch {
        /* fall through */
      }
    }

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
          pushCandidate(candidates, images?.large ?? null);
          pushCandidate(candidates, images?.small ?? null);
        }
      } catch {
        /* fall through */
      }
    }

    return pickPreferredCollectionCoverUrl(candidates);
  }

  private async persistCoverImageUrl(
    collectionKey: string,
    rawUrl: string,
  ): Promise<string | null> {
    const k = collectionKey.toLowerCase();
    const trimmed = normalizeCatalogCoverPublicUrl(rawUrl.trim());
    if (!isPersistableCoverUrl(trimmed)) {
      return null;
    }

    const patch: QueryDeepPartialEntity<MarketplaceCollection> = {
      coverImageUrl: trimmed,
    };

    await this.collectionRepo.update({ collectionKey: k }, patch);
    return trimmed;
  }
}
