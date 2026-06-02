import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryDeepPartialEntity, Repository } from 'typeorm';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { IpfsGatewayResolverService } from '../../blockchain/ipfs-gateway-resolver.service';
import { CardhedgerService } from '../../cardhedger/cardhedger.service';
import { specIdStringFromPsaCertBody } from '../../psa/psa-public-api.service';
import { PsaSpecScraperService } from '../../psa/psa-spec-scraper.service';
import {
  extractCollectionRepresentativeImage,
  normalizeImageUrl,
  psaCertNumberFromGradedMeta,
} from '../utils/collection-image.util';
import { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import { Order, OrderSide, OrderStatus } from '../entities/order.entity';
import { PsaCertSnapshotService } from './psa-cert-snapshot.service';
import { psaSpecIdFromComponentsRow } from './collection-listing-meta.helpers';

/**
 * Collection cover images: PSA spec scrape, Cardhedger catalog, TCG API, representative resolve.
 */
@Injectable()
export class CollectionCoverService {
  private readonly logger = new Logger(CollectionCoverService.name);

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
  ) {}

  private collectionActiveOrdersCap(): number {
    return this.config.get<number>('marketplace.collectionActiveOrdersMax') ?? 2_000;
  }

  private async findOne(key: string): Promise<MarketplaceCollection | null> {
    return this.collectionRepo.findOne({
      where: { collectionKey: key.toLowerCase() },
    });
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

  private async activeBidsForCollection(collectionKey: string): Promise<Order[]> {
    return this.orderRepo.find({
      where: {
        collectionKey: collectionKey.toLowerCase(),
        status: OrderStatus.ACTIVE,
        side: OrderSide.BID,
      },
      order: { createdAt: 'DESC' },
      take: this.collectionActiveOrdersCap(),
    });
  }

  clearResolveInflight(collectionKey: string): void {
    this.representativeImageResolveInflight.delete(collectionKey.toLowerCase());
  }

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
        this.config.get<boolean>('psa.specCoverAllowFallback') === true;
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
  async resolveBestCoverUrl(
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
  async persistCoverFromMetaIfMissing(
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

    const specFb = psaSpecIdFromComponentsRow(row.components);
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
      psaSpecFb = psaSpecIdFromComponentsRow(col?.components);
    }
    return this.resolveBestCoverUrl(meta, psaSpecFb);
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
    const psaSpecFromComp = psaSpecIdFromComponentsRow(col?.components);

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
}
