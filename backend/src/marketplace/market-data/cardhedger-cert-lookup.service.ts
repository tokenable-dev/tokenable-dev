import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  TTL_CACHE_PROVIDER,
  type TtlCacheProvider,
} from '../../common/cache/ttl-cache.interface';
import { CardhedgerService } from '../../cardhedger/cardhedger.service';
import type { CardhedgerCardRow } from './cardhedger-market-data.types';

/**
 * PSA cert → Cardhedger catalog via `POST /v1/cards/details-by-certs`.
 * Shared by resolve, mint preview, and collection identity — kept separate from
 * {@link CardhedgerMintService} to avoid Resolve ↔ Mint circular DI.
 */
@Injectable()
export class CardhedgerCertLookupService {
  private readonly logger = new Logger(CardhedgerCertLookupService.name);

  private readonly CERT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
  private static readonly NS_CERT_DETAILS_BATCH = 'cardhedger:certDetailsBatch';
  private static readonly CERT_DETAILS_BATCH_MAX = 100;

  constructor(
    private readonly cardhedger: CardhedgerService,
    @Inject(TTL_CACHE_PROVIDER) private readonly ttlCache: TtlCacheProvider,
  ) {}

  isConfigured(): boolean {
    try {
      this.cardhedger.assertConfigured();
      return true;
    } catch {
      return false;
    }
  }

  normalizeCertDigits(cert: string | undefined): string {
    const d = String(cert ?? '').replace(/\D/g, '');
    return d.length >= 7 ? d : '';
  }

  /**
   * Cardhedger `POST /v1/cards/details-by-certs` — up to 100 certs per request.
   * Returns cert digits → catalog row (skips entries with no `card`).
   * Additionally captures `cert_info.description` even when `card` is null into
   * the companion `descriptionOut` map (when provided), enabling fallback text search.
   */
  async fetchCardRowsByCertsBatch(
    certs: string[],
    descriptionOut?: Map<string, string>,
  ): Promise<Map<string, CardhedgerCardRow>> {
    const out = new Map<string, CardhedgerCardRow>();
    if (!this.isConfigured()) return out;

    const unique = [
      ...new Set(
        certs
          .map((c) => this.normalizeCertDigits(c))
          .filter((c) => c.length > 0),
      ),
    ];
    if (unique.length === 0) return out;

    for (
      let i = 0;
      i < unique.length;
      i += CardhedgerCertLookupService.CERT_DETAILS_BATCH_MAX
    ) {
      const chunk = unique.slice(
        i,
        i + CardhedgerCertLookupService.CERT_DETAILS_BATCH_MAX,
      );
      const cacheKey = chunk.join(',');
      const cached = this.ttlCache.get<{
        map: Map<string, CardhedgerCardRow>;
        descriptions?: Map<string, string>;
      }>(CardhedgerCertLookupService.NS_CERT_DETAILS_BATCH, cacheKey);
      if (cached) {
        for (const [k, v] of cached.map) out.set(k, v);
        if (descriptionOut && cached.descriptions) {
          for (const [k, v] of cached.descriptions) descriptionOut.set(k, v);
        }
        continue;
      }
      const chunkMap = new Map<string, CardhedgerCardRow>();
      const chunkDescriptions = new Map<string, string>();
      try {
        const body = await this.cardhedger.forwardJson(
          'POST',
          '/v1/cards/details-by-certs',
          {
            body: { certs: chunk, grader: 'PSA' },
          },
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
            card?: CardhedgerCardRow;
          };
          const certDigits = this.normalizeCertDigits(
            String(row.cert_info?.cert ?? ''),
          );
          if (!certDigits) continue;
          const desc =
            typeof row.cert_info?.description === 'string' &&
            row.cert_info.description.trim()
              ? row.cert_info.description.trim()
              : null;
          if (desc) chunkDescriptions.set(certDigits, desc);
          const card = row.card;
          const cardId =
            typeof card?.card_id === 'string' ? card.card_id.trim() : '';
          if (cardId && card) {
            chunkMap.set(certDigits, card);
          }
        }
        this.ttlCache.set(
          CardhedgerCertLookupService.NS_CERT_DETAILS_BATCH,
          cacheKey,
          { map: chunkMap, descriptions: chunkDescriptions },
          this.CERT_CACHE_TTL_MS,
        );
        for (const [k, v] of chunkMap) out.set(k, v);
        if (descriptionOut) {
          for (const [k, v] of chunkDescriptions) descriptionOut.set(k, v);
        }
      } catch (e) {
        this.logger.warn(
          `details-by-certs batch failed (${chunk.length} certs): ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }
    return out;
  }

  async getCardRowByCert(cert: string): Promise<{
    row: CardhedgerCardRow | null;
    certDescription: string | null;
  }> {
    const digits = this.normalizeCertDigits(cert);
    if (!digits) return { row: null, certDescription: null };
    const descriptions = new Map<string, string>();
    const cardMap = await this.fetchCardRowsByCertsBatch(
      [digits],
      descriptions,
    );
    return {
      row: cardMap.get(digits) ?? null,
      certDescription: descriptions.get(digits) ?? null,
    };
  }
}
