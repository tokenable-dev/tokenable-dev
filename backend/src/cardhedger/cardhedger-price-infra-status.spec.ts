import { buildCardhedgerPriceInfraStatus } from './cardhedger-price-infra-status';
import { readCardhedgerFeatureFlags } from '../config/cardhedger-feature-flags.util';

describe('buildCardhedgerPriceInfraStatus', () => {
  it('reports flags off and delta_poll_only without client subscribe', () => {
    const out = buildCardhedgerPriceInfraStatus({
      flags: readCardhedgerFeatureFlags({}),
      frontendUrl: 'https://app.example',
      webhookSecretConfigured: false,
      clientId: '',
      checkpoint: null,
      recentDeltaRuns: [],
      recentCsvRuns: [],
      activeSubscriptions: 0,
      cronEnv: { NODE_ENV: 'development' },
    });
    expect(out.mode).toBe('delta_poll_only');
    expect(out.flags.priceWebhookEnabled).toBe(false);
    expect(out.flags.dailyPriceDeltaImportEnabled).toBe(false);
    expect(out.webhookUrl).toBe(
      'https://app.example/api/webhooks/cardhedger/price-updates',
    );
    expect(out.deltaCronEnabled).toBe(false);
    expect(out.activeSubscriptions).toBe(0);
    expect(out.recentDeltaRuns).toEqual([]);
  });
});
