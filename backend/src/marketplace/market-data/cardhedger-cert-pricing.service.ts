import { Inject, Injectable, Logger } from '@nestjs/common';
import { CardhedgerService } from '../../cardhedger/cardhedger.service';
import {
  TTL_CACHE_PROVIDER,
  type TtlCacheProvider,
} from '../../common/cache/ttl-cache.interface';
import type { CardhedgerCardRow } from './cardhedger-market-data.types';
import {
  cardhedgerFmvMapKey,
  certPriceDiffPct,
  chunkCertBatch,
  chunkFmvBatchItems,
  normalizeCertDigits,
  parseCardhedgerFmvRecord,
  parseCertPriceResult,
  type CardhedgerCertPriceResult,
  type CardhedgerFmvBatchItem,
  type CardhedgerFmvResult,
} from './cardhedger-cert-price.util';

/**
 * Cert-based bulk pricing via Cardhedger `batch-prices-by-cert` and
 * sparse fallback `batch-price-estimate` (Phase 4 pilot).
 */
@Injectable()
export class CardhedgerCertPricingService {
  private readonly logger = new Logger(CardhedgerCertPricingService.name);
  private readonly CACHE_TTL_MS = 60 * 60 * 1000;
  private static readonly NS_CERT_PRICES = 'cardhedger:certPricesBatch';
  private static readonly NS_PRICE_ESTIMATE = 'cardhedger:batchPriceEstimate';

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

  /**
   * `POST /v1/cards/batch-prices-by-cert` — cert digits → card + estimate.
   */
  async fetchPricesByCertsBatch(
    certs: string[],
  ): Promise<Map<string, CardhedgerCertPriceResult>> {
    const out = new Map<string, CardhedgerCertPriceResult>();
    if (!this.isConfigured()) return out;

    const unique = [
      ...new Set(
        certs
          .map((c) => normalizeCertDigits(c))
          .filter((c) => c.length > 0),
      ),
    ];
    if (unique.length === 0) return out;

    for (const chunk of chunkCertBatch(unique)) {
      const cacheKey = chunk.join(',');
      const cached = this.ttlCache.get<Map<string, CardhedgerCertPriceResult>>(
        CardhedgerCertPricingService.NS_CERT_PRICES,
        cacheKey,
      );
      if (cached) {
        for (const [k, v] of cached) out.set(k, v);
        continue;
      }

      const chunkMap = new Map<string, CardhedgerCertPriceResult>();
      try {
        const body = await this.cardhedger.forwardJson(
          'POST',
          '/v1/cards/batch-prices-by-cert',
          {
            body: { certs: chunk, grader: 'PSA' },
            metricsOperation: 'mint_previews',
          },
        );
        const results = Array.isArray(
          (body as { results?: unknown[] } | null)?.results,
        )
          ? ((body as { results: unknown[] }).results ?? [])
          : Array.isArray((body as { certs?: unknown[] } | null)?.certs)
            ? ((body as { certs: unknown[] }).certs ?? [])
            : [];

        for (const raw of results) {
          const parsed = parseCertPriceResult(raw);
          if (parsed) chunkMap.set(parsed.cert, parsed);
        }

        this.ttlCache.set(
          CardhedgerCertPricingService.NS_CERT_PRICES,
          cacheKey,
          chunkMap,
          this.CACHE_TTL_MS,
        );
        for (const [k, v] of chunkMap) out.set(k, v);
      } catch (e) {
        this.logger.warn(
          `batch-prices-by-cert failed (${chunk.length} certs): ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }

    this.logger.debug(
      JSON.stringify({
        msg: 'cert_prices_batch',
        requested: unique.length,
        resolved: out.size,
        withPrice: [...out.values()].filter((r) => r.price != null).length,
      }),
    );
    return out;
  }

  /**
   * Sparse fallback — `POST /v1/cards/batch-price-estimate` when cert batch has card but no price.
   */
  async fetchPriceEstimatesBatch(
    items: CardhedgerFmvBatchItem[],
  ): Promise<Map<string, CardhedgerFmvResult | null>> {
    const out = new Map<string, CardhedgerFmvResult | null>();
    if (!this.isConfigured()) return out;

    const normalized: CardhedgerFmvBatchItem[] = [];
    const seen = new Set<string>();
    for (const raw of items) {
      const card_id = String(raw.card_id ?? '').trim();
      const grade = String(raw.grade ?? '').trim();
      if (!card_id || !grade) continue;
      const key = cardhedgerFmvMapKey(card_id, grade);
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push({ card_id, grade });
    }
    if (normalized.length === 0) return out;

    const uncached: CardhedgerFmvBatchItem[] = [];
    for (const it of normalized) {
      const key = cardhedgerFmvMapKey(it.card_id, it.grade);
      const hit = this.ttlCache.get<{ value: CardhedgerFmvResult | null }>(
        CardhedgerCertPricingService.NS_PRICE_ESTIMATE,
        key,
      );
      if (hit) {
        out.set(key, hit.value);
      } else {
        uncached.push(it);
      }
    }

    for (const chunk of chunkFmvBatchItems(uncached)) {
      try {
        const body = await this.cardhedger.forwardJson(
          'POST',
          '/v1/cards/batch-price-estimate',
          {
            body: { items: chunk },
            metricsOperation: 'mint_previews',
          },
        );
        const results = Array.isArray(
          (body as { results?: unknown[] } | null)?.results,
        )
          ? ((body as { results: unknown[] }).results ?? [])
          : [];

        for (let i = 0; i < chunk.length; i++) {
          const req = chunk[i];
          const key = cardhedgerFmvMapKey(req.card_id, req.grade);
          const raw =
            results[i] != null && typeof results[i] === 'object'
              ? (results[i] as Record<string, unknown>)
              : null;
          const parsed = raw ? parseCardhedgerFmvRecord(raw) : null;
          out.set(key, parsed);
          this.ttlCache.set(
            CardhedgerCertPricingService.NS_PRICE_ESTIMATE,
            key,
            { value: parsed },
            this.CACHE_TTL_MS,
          );
        }
      } catch (e) {
        this.logger.warn(
          `batch-price-estimate failed (${chunk.length} items): ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }

    return out;
  }

  /**
   * Pilot-week accuracy log — compare cert batch headline vs legacy catalog PSA slot.
   */
  logPilotPriceDiffs(
    certPrices: Map<string, CardhedgerCertPriceResult>,
    legacyRows: Map<string, CardhedgerCardRow>,
    readLegacyCatalogUsd: (
      row: CardhedgerCardRow,
      gradeLabel: string | null,
    ) => number | null,
  ): void {
    const diffs: number[] = [];
    for (const [cert, cp] of certPrices) {
      const newPrice = cp.price;
      const legacy = legacyRows.get(cert);
      const gradeLabel = cp.certInfo?.grade ?? 'PSA 10';
      const oldPrice = legacy ? readLegacyCatalogUsd(legacy, gradeLabel) : null;
      const diffPct = certPriceDiffPct(newPrice, oldPrice);
      if (diffPct != null) diffs.push(Math.abs(diffPct));

      this.logger.log(
        JSON.stringify({
          msg: 'cert_price_pilot_diff',
          cert,
          newPriceUsd: newPrice,
          oldCatalogUsd: oldPrice,
          diffPct,
          cardIdMatch:
            legacy?.card_id && cp.card?.card_id
              ? legacy.card_id === cp.card.card_id
              : null,
          cardSource: cp.card_source,
          matchConfidence: cp.match_confidence,
        }),
      );
    }

    if (diffs.length > 0) {
      const sorted = [...diffs].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median =
        sorted.length % 2 === 0
          ? (sorted[mid - 1]! + sorted[mid]!) / 2
          : sorted[mid]!;
      this.logger.log(
        JSON.stringify({
          msg: 'cert_price_pilot_diff_summary',
          sampleCount: diffs.length,
          medianAbsDiffPct: Math.round(median * 10) / 10,
        }),
      );
    }
  }
}
