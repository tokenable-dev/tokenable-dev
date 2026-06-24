/**
 * Cardhedger rollout feature flags (Phase 0+).
 * Parsed from env — defaults keep existing behaviour until explicitly enabled.
 */

export interface CardhedgerFeatureFlags {
  /** Phase 2 — use POST /v1/cards/card-fmv-batch for bulk headline FMV. */
  fmvBatchEnabled: boolean;
  /** Phase 4 — cert → price via POST /v1/cards/batch-prices-by-cert. */
  batchPricesByCertEnabled: boolean;
  /** Phase 4 — sparse cards via POST /v1/cards/batch-price-estimate. */
  batchPriceEstimateEnabled: boolean;
  /** Phase 5 — PSA slab OCR via POST /v1/cards/prices-by-cert-ocr. */
  pricesByCertOcrEnabled: boolean;
  /** Phase 6 — try card-match before multi card-search in resolve. */
  cardMatchFirst: boolean;
  /** Phase 2 pilot — skip comps fetch in mint-previews (headline price only). */
  mintPreviewSkipComps: boolean;
  /** Phase 4 pilot — log old vs new cert price diff (extra details-by-certs for compare). */
  certPricePilotCompare: boolean;
  /** Phase 8A — inbound Cardhedger price webhook + subscribe-price-updates. */
  priceWebhookEnabled: boolean;
  priceSubscribeEnabled: boolean;
  /** Phase 8B — nightly POST /v1/cards/price-updates delta (non-Enterprise path). */
  dailyPriceDeltaImportEnabled: boolean;
  /** Phase 8B — optional CSV daily-price-export (Elite/Enterprise only). */
  dailyPriceExportCsvEnabled: boolean;
}

function envTruthy(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/**
 * Read Cardhedger optimisation flags from process env.
 * All default to `false` so production behaviour is unchanged until rollout.
 */
export function readCardhedgerFeatureFlags(
  env: NodeJS.ProcessEnv = process.env,
): CardhedgerFeatureFlags {
  return {
    fmvBatchEnabled: envTruthy(env.CARDHEDGER_FMV_BATCH_ENABLED),
    batchPricesByCertEnabled: envTruthy(
      env.CARDHEDGER_BATCH_PRICES_BY_CERT_ENABLED,
    ),
    batchPriceEstimateEnabled: envTruthy(
      env.CARDHEDGER_BATCH_PRICE_ESTIMATE_ENABLED,
    ),
    pricesByCertOcrEnabled: envTruthy(env.CARDHEDGER_PRICES_BY_CERT_OCR_ENABLED),
    cardMatchFirst: envTruthy(env.CARDHEDGER_CARD_MATCH_FIRST),
    mintPreviewSkipComps: envTruthy(env.CARDHEDGER_MINT_PREVIEW_SKIP_COMPS),
    certPricePilotCompare: envTruthy(env.CARDHEDGER_CERT_PRICE_PILOT_COMPARE),
    priceWebhookEnabled: envTruthy(env.CARDHEDGER_PRICE_WEBHOOK_ENABLED),
    priceSubscribeEnabled: envTruthy(env.CARDHEDGER_PRICE_SUBSCRIBE_ENABLED),
    dailyPriceDeltaImportEnabled: envTruthy(
      env.CARDHEDGER_DAILY_PRICE_DELTA_IMPORT_ENABLED,
    ),
    dailyPriceExportCsvEnabled: envTruthy(
      env.CARDHEDGER_DAILY_EXPORT_CSV_ENABLED,
    ),
  };
}
