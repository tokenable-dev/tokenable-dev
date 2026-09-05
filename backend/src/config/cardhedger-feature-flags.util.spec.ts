import { readCardhedgerFeatureFlags } from './cardhedger-feature-flags.util';

describe('readCardhedgerFeatureFlags', () => {
  it('defaults all flags to false', () => {
    expect(readCardhedgerFeatureFlags({})).toEqual({
      fmvBatchEnabled: false,
      batchPricesByCertEnabled: false,
      batchPriceEstimateEnabled: false,
      pricesByCertOcrEnabled: false,
      cardMatchFirst: false,
      mintPreviewSkipComps: false,
      certPricePilotCompare: false,
      priceWebhookEnabled: false,
      priceSubscribeEnabled: false,
      dailyPriceDeltaImportEnabled: false,
      dailyPriceExportCsvEnabled: false,
    });
  });

  it('parses truthy env values', () => {
    expect(
      readCardhedgerFeatureFlags({
        CARDHEDGER_FMV_BATCH_ENABLED: '1',
        CARDHEDGER_BATCH_PRICES_BY_CERT_ENABLED: 'true',
        CARDHEDGER_BATCH_PRICE_ESTIMATE_ENABLED: 'yes',
        CARDHEDGER_PRICES_BY_CERT_OCR_ENABLED: 'on',
        CARDHEDGER_CARD_MATCH_FIRST: '1',
        CARDHEDGER_MINT_PREVIEW_SKIP_COMPS: 'true',
        CARDHEDGER_CERT_PRICE_PILOT_COMPARE: '1',
        CARDHEDGER_PRICE_WEBHOOK_ENABLED: '1',
        CARDHEDGER_DAILY_PRICE_DELTA_IMPORT_ENABLED: 'true',
      }),
    ).toEqual({
      fmvBatchEnabled: true,
      batchPricesByCertEnabled: true,
      batchPriceEstimateEnabled: true,
      pricesByCertOcrEnabled: true,
      cardMatchFirst: true,
      mintPreviewSkipComps: true,
      certPricePilotCompare: true,
      priceWebhookEnabled: true,
      priceSubscribeEnabled: false,
      dailyPriceDeltaImportEnabled: true,
      dailyPriceExportCsvEnabled: false,
    });
  });

  it('treats 0/false as disabled', () => {
    expect(
      readCardhedgerFeatureFlags({
        CARDHEDGER_FMV_BATCH_ENABLED: '0',
        CARDHEDGER_CARD_MATCH_FIRST: 'false',
      }).fmvBatchEnabled,
    ).toBe(false);
  });
});
