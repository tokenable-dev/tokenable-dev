import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryDeepPartialEntity, Repository } from 'typeorm';
import type { SupportedChainId } from '../../blockchain/chain-config.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { IpfsGatewayResolverService } from '../../blockchain/ipfs-gateway-resolver.service';
import { CardhedgerService } from '../../cardhedger/cardhedger.service';
import { mergePsaVarietyWithMintVariant } from '../../psa/psa-variety-catalog.util';
import {
  cardhedgerCertRowUsableForPsaVariety,
  cardhedgerRowMatchesPsaVariety,
  psaVarietyHasNamedCollectibleIdentity,
} from '../utils/cardhedger-psa-variety.util';
import {
  normalizeImageUrl,
  rankCollectionCoverUrls,
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

function psaVarietyFromMintMeta(meta: Record<string, unknown>): string {
  const props = meta.properties as Record<string, unknown> | undefined;
  const graded = (props?.graded ?? meta.graded) as
    | Record<string, unknown>
    | undefined;
  if (!graded || typeof graded !== 'object') return '';
  const psa = graded.psa as Record<string, unknown> | undefined;
  const varietyRaw = [psa?.Variety, psa?.variety, psa?.varietyHint].find(
    (x): x is string => typeof x === 'string' && Boolean(x.trim()),
  );
  const card = graded.card as Record<string, unknown> | undefined;
  const mintVariant =
    typeof card?.variant === 'string' ? card.variant.trim() : '';
  return mergePsaVarietyWithMintVariant(varietyRaw, mintVariant);
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
    const ranked = await this.resolveRankedCatalogImageUrlsFromMeta(meta);
    return ranked[0] ?? null;
  }

  /**
   * Admin catalog create (no mint): PSA cert → Cardhedger `details-by-certs`
   * → attach `graded.cardhedger.{cardId,imageUrl,searchQuery}` onto metadata so
   * {@link resolveCoverUrlForNewCollection} can fetch the catalog image and
   * ingest it to S3. No-op when Cardhedger is unconfigured or the cert is unknown.
   */
  async attachCardhedgerFromPsaCert(
    meta: Record<string, unknown>,
    certNumber: string,
  ): Promise<Record<string, unknown>> {
    const digits = String(certNumber ?? '').replace(/\D/g, '');
    if (digits.length < 7) return meta;

    try {
      this.cardhedger.assertConfigured();
    } catch {
      return meta;
    }

    let cardId = '';
    let imageUrl = '';
    let searchQuery = '';
    const psaVariety = psaVarietyFromMintMeta(meta);

    try {
      const body = await this.cardhedger.forwardJson(
        'POST',
        '/v1/cards/details-by-certs',
        { body: { certs: [digits], grader: 'PSA' } },
      );
      const results = Array.isArray(
        (body as { results?: unknown[] } | null)?.results,
      )
        ? ((body as { results: unknown[] }).results ?? [])
        : [];
      for (const raw of results) {
        if (typeof raw !== 'object' || raw == null) continue;
        const row = raw as {
          cert_info?: { cert?: string | number; description?: string };
          card?: Record<string, unknown>;
        };
        const rowDigits = String(row.cert_info?.cert ?? '').replace(/\D/g, '');
        if (rowDigits && rowDigits !== digits) continue;
        const desc =
          typeof row.cert_info?.description === 'string'
            ? row.cert_info.description.trim()
            : '';
        if (desc) searchQuery = desc;
        const card = row.card;
        if (card && typeof card === 'object') {
          if (cardhedgerCertRowUsableForPsaVariety(card, psaVariety)) {
            const id =
              typeof card.card_id === 'string' ? card.card_id.trim() : '';
            if (id) cardId = id;
            const img =
              typeof card.image === 'string' ? card.image.trim() : '';
            if (img) imageUrl = img;
          }
        }
        break;
      }
    } catch (e) {
      this.logger.warn(
        `Cardhedger details-by-certs for catalog create failed (${digits}): ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      return meta;
    }

    if (cardId && !imageUrl) {
      try {
        const body = await this.cardhedger.forwardJson(
          'POST',
          '/v1/cards/card-details',
          { body: { card_id: cardId } },
        );
        const cards = (body as { cards?: unknown[] }).cards;
        if (Array.isArray(cards) && cards.length > 0) {
          const row = cards[0] as Record<string, unknown>;
          const img =
            typeof row.image === 'string' ? row.image.trim() : '';
          if (img) imageUrl = img;
        }
      } catch {
        /* cover resolve may still search by name */
      }
    }

    // details-by-certs often returns `card: null`, or a sibling finish (Reverse
    // Foil on a Master Ball slab). Resolve via search with the same Variety gate.
    if (!cardId) {
      const fromSearch = await this.resolveCardhedgerCardIdBySearch(
        meta,
        searchQuery,
      );
      if (fromSearch) {
        cardId = fromSearch.cardId;
        if (!imageUrl && fromSearch.imageUrl) imageUrl = fromSearch.imageUrl;
        if (!searchQuery && fromSearch.searchQuery) {
          searchQuery = fromSearch.searchQuery;
        }
      }
    }

    if (!cardId && !imageUrl && !searchQuery) return meta;

    const props =
      meta.properties && typeof meta.properties === 'object'
        ? { ...(meta.properties as Record<string, unknown>) }
        : {};
    const gradedBase =
      (props.graded ?? meta.graded) &&
      typeof (props.graded ?? meta.graded) === 'object'
        ? {
            ...((props.graded ?? meta.graded) as Record<string, unknown>),
          }
        : {};
    const existingCh =
      gradedBase.cardhedger && typeof gradedBase.cardhedger === 'object'
        ? { ...(gradedBase.cardhedger as Record<string, unknown>) }
        : {};

    if (cardId && !existingCh.cardId) existingCh.cardId = cardId;
    if (imageUrl && !existingCh.imageUrl) existingCh.imageUrl = imageUrl;
    if (searchQuery && !existingCh.searchQuery) {
      existingCh.searchQuery = searchQuery;
    }

    gradedBase.cardhedger = existingCh;
    props.graded = gradedBase;
    return { ...meta, properties: props };
  }

  /**
   * Resolve Cardhedger/TCG image for a new collection, download it, and store
   * on catalog S3. Tries ranked candidates and skips tiny Cardhedger thumbs
   * (~180px). Falls back to the best remote URL when S3 is not configured or
   * ingest fails (listing must not block).
   */
  async resolveCoverUrlForNewCollection(
    collectionKey: string,
    meta: Record<string, unknown>,
  ): Promise<string | null> {
    const ranked = await this.resolveRankedCatalogImageUrlsFromMeta(meta);
    if (ranked.length === 0) return null;
    if (!this.catalogCoverS3.isConfigured()) return ranked[0] ?? null;

    try {
      const { publicUrl } = await this.catalogCoverS3.ingestBestRemoteImage(
        collectionKey,
        ranked,
      );
      return publicUrl;
    } catch (e) {
      this.logger.warn(
        `Catalog cover S3 ingest on create failed for ${collectionKey}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      return ranked[0] ?? null;
    }
  }

  /**
   * Persist cover when missing, or replace when a higher-scoring catalog URL is
   * resolved. If the existing cover is our S3 object but too small (Cardhedger
   * thumb), re-ingest the best candidate.
   */
  async upgradeCoverFromMetaIfBetter(
    collectionKey: string,
    meta: Record<string, unknown>,
  ): Promise<string | null> {
    const k = collectionKey.toLowerCase();
    const row = await this.findOne(k);
    if (!row) return null;

    const current = row.coverImageUrl?.trim() ?? '';
    const ranked = await this.resolveRankedCatalogImageUrlsFromMeta(meta);
    if (ranked.length === 0) return current || null;

    const ourKey =
      current &&
      catalogCoverObjectKeyFromPublicUrl(
        current,
        this.catalogCoverS3.getPublicBaseUrl(),
      );

    if (this.catalogCoverS3.isConfigured() && (!current || ourKey)) {
      let shouldReingest = !current;
      if (ourKey && current) {
        try {
          const existing = await this.catalogCoverS3.downloadRemoteImage(current);
          shouldReingest = !this.catalogCoverS3.isAdequateCatalogCoverSize(
            existing.width,
            existing.height,
          );
        } catch {
          shouldReingest = true;
        }
      }
      if (shouldReingest) {
        try {
          const { publicUrl } = await this.catalogCoverS3.ingestBestRemoteImage(
            k,
            ranked,
          );
          return this.persistCoverImageUrl(k, publicUrl);
        } catch (e) {
          this.logger.warn(
            `Catalog cover upgrade ingest failed for ${k}: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        }
      }
    }

    const next = ranked[0] ?? null;
    if (!next) return current || null;
    if (!current) {
      return this.persistCoverImageUrl(k, next);
    }
    if (scoreCollectionCoverUrl(next) > scoreCollectionCoverUrl(current)) {
      if (this.catalogCoverS3.isConfigured()) {
        try {
          const { publicUrl } = await this.catalogCoverS3.ingestBestRemoteImage(
            k,
            ranked,
          );
          return this.persistCoverImageUrl(k, publicUrl);
        } catch {
          /* fall through to remote URL */
        }
      }
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
    chainId?: SupportedChainId,
  ): Promise<string | null> {
    const meta = await this.loadTokenMeta(Number(tokenId), chainId);
    if (!meta) return null;
    return this.resolveCoverUrlFromMeta(meta);
  }

  /** Admin / ops: re-resolve from token meta and persist only if score improves. */
  async upgradeCoverFromToken(
    collectionKey: string,
    tokenId: string,
    chainId?: SupportedChainId,
  ): Promise<{ coverImageUrl: string | null; upgraded: boolean }> {
    const k = collectionKey.toLowerCase();
    const row = await this.findOne(k);
    if (!row) throw new Error('COLLECTION_NOT_FOUND');
    const prev = row.coverImageUrl?.trim() ?? '';

    const meta = await this.loadTokenMeta(Number(tokenId), chainId);
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

  private async loadTokenMeta(
    tokenId: number,
    chainId?: SupportedChainId,
  ): Promise<Record<string, unknown> | null> {
    try {
      const uri = await this.blockchain.getRwaTokenURI(tokenId, chainId);
      return await this.ipfsResolver.fetchMetadataJson(uri);
    } catch {
      return null;
    }
  }

  /**
   * When cert lookup has no `card`, search Cardhedger by cert description / PSA
   * hints and return the best matching `card_id` (+ image when present).
   */
  private async resolveCardhedgerCardIdBySearch(
    meta: Record<string, unknown>,
    certDescription: string,
  ): Promise<{
    cardId: string;
    imageUrl: string;
    searchQuery: string;
  } | null> {
    const props = meta.properties as Record<string, unknown> | undefined;
    const graded = (props?.graded ?? meta.graded) as
      | Record<string, unknown>
      | undefined;
    const cardMeta = graded?.card as Record<string, unknown> | undefined;
    const psaMeta = graded?.psa as Record<string, unknown> | undefined;

    const cardName = (
      typeof cardMeta?.name === 'string'
        ? cardMeta.name
        : typeof psaMeta?.cardNameHint === 'string'
          ? psaMeta.cardNameHint
          : typeof psaMeta?.subject === 'string'
            ? psaMeta.subject
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
          : typeof psaMeta?.brand === 'string'
            ? psaMeta.brand
            : ''
    ).trim();
    const year = String(cardMeta?.year ?? psaMeta?.year ?? '').trim();

    const search =
      certDescription.trim() ||
      [cardName, cardNumber, setName, year].filter(Boolean).join(' ');
    if (!search) return null;

    try {
      this.cardhedger.assertConfigured();
      const body = await this.cardhedger.forwardJson(
        'POST',
        '/v1/cards/card-search',
        { body: { search, page: 1, page_size: 10 } },
      );
      const cards = Array.isArray((body as { cards?: unknown[] })?.cards)
        ? ((body as { cards: unknown[] }).cards ?? [])
        : [];
      if (cards.length === 0) return null;

      const norm = (s: string) =>
        s
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '')
          .replace(/[^a-z0-9]/g, '');
      const wantNum = norm(cardNumber).replace(/^#/, '');
      const wantNameWords = norm(cardName).match(/[a-z0-9]+/g) ?? [];
      const psaVariety = psaVarietyFromMintMeta(meta);
      const requireNamed =
        psaVarietyHasNamedCollectibleIdentity(psaVariety);

      let bestCompatible: Record<string, unknown> | null = null;
      let bestNameNum: Record<string, unknown> | null = null;
      let bestFirst: Record<string, unknown> | null = null;
      for (const row of cards as Record<string, unknown>[]) {
        const id = typeof row.card_id === 'string' ? row.card_id.trim() : '';
        if (!id) continue;
        if (!bestFirst) bestFirst = row;
        const rowNum = norm(String(row.number ?? '')).replace(/^#/, '');
        const rowDesc = norm(String(row.description ?? row.name ?? ''));
        const numOk = !wantNum || rowNum === wantNum;
        const nameOk =
          wantNameWords.length === 0 ||
          wantNameWords.every((w) => rowDesc.includes(w));
        if (!(numOk && nameOk)) continue;
        if (!bestNameNum) bestNameNum = row;
        if (cardhedgerRowMatchesPsaVariety(row, psaVariety)) {
          bestCompatible = row;
          break;
        }
      }
      const best =
        bestCompatible ?? (requireNamed ? null : (bestNameNum ?? bestFirst));
      if (!best) return null;
      const cardId = String(best.card_id ?? '').trim();
      if (!cardId) return null;
      const imageUrl =
        typeof best.image === 'string' ? best.image.trim() : '';
      return {
        cardId,
        imageUrl,
        searchQuery: search,
      };
    } catch {
      return null;
    }
  }

  /**
   * Gather catalog candidates (Cardhedger + Pokémon TCG when applicable), ranked
   * best → worst. Collects multiple Cardhedger matches so a tiny `/crop_image`
   * thumb can lose to a Holo sibling or Pokémon TCG hires after download.
   */
  private async resolveRankedCatalogImageUrlsFromMeta(
    meta: Record<string, unknown>,
  ): Promise<string[]> {
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
    const chSearchQuery =
      typeof ch?.searchQuery === 'string' ? ch.searchQuery.trim() : '';
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
    const brand = String(psaMeta?.brand ?? psaMeta?.Brand ?? '').trim();
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

    const searchSeed = chSearchQuery || cardName;
    if (searchSeed) {
      try {
        this.cardhedger.assertConfigured();
        const parts = chSearchQuery
          ? [chSearchQuery]
          : [cardName, cardNumber, setName, year].filter(Boolean);
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
          // Keep every plausible match — size is verified after download.
          if (numOk && (nameOk || setOk)) {
            pushCandidate(candidates, rawImg);
          }
        }
      } catch {
        /* fall through */
      }
    }

    const isPokemon =
      /pokemon/i.test(setName) ||
      /pokemon/i.test(cardName) ||
      /pokemon/i.test(brand) ||
      /pokemon/i.test(chSearchQuery) ||
      /pokemon/i.test(category) ||
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
          // Prefer a few top set-year matches so hires can beat a bad Cardhedger thumb.
          for (const card of sorted.slice(0, 3)) {
            const images = card?.images as Record<string, string> | undefined;
            pushCandidate(candidates, images?.large ?? null);
            pushCandidate(candidates, images?.small ?? null);
          }
        }
      } catch {
        /* fall through */
      }
    }

    return rankCollectionCoverUrls(candidates).filter(isPersistableCoverUrl);
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
