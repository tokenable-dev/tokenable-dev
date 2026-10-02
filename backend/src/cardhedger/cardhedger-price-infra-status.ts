import type { CardhedgerDailyPriceExportRun } from './entities/cardhedger-daily-price-export-run.entity';
import type { CardhedgerPriceDeltaCheckpoint } from './entities/cardhedger-price-delta-checkpoint.entity';
import type { CardhedgerPriceDeltaImportRun } from './entities/cardhedger-price-delta-import-run.entity';
import type { CardhedgerFeatureFlags } from '../config/cardhedger-feature-flags.util';
import { isCardhedgerPriceDeltaCronEnabled } from '../config/cardhedger-feature-flags.util';

export function serializeCardhedgerDeltaRun(run: CardhedgerPriceDeltaImportRun) {
  return {
    id: run.id,
    ranAt: run.ranAt.toISOString(),
    sinceIso: run.sinceIso,
    latestTimestampIso: run.latestTimestampIso,
    updateCount: run.updateCount,
    uniqueCardIds: run.uniqueCardIds,
    matchedCollectionCount: run.matchedCollectionCount,
    deltaMatchedCollectionCount: run.deltaMatchedCollectionCount ?? 0,
    catalogFallbackCount: run.catalogFallbackCount ?? 0,
    unmatchedUpdateCount: run.unmatchedUpdateCount,
    enqueuedCollectionKeys: run.enqueuedCollectionKeys,
    matchedCollections: run.matchedCollections,
    status: run.status,
    errorMessage: run.errorMessage,
  };
}

export function buildCardhedgerPriceInfraStatus(input: {
  flags: CardhedgerFeatureFlags;
  frontendUrl: string;
  webhookSecretConfigured: boolean;
  clientId: string;
  checkpoint: CardhedgerPriceDeltaCheckpoint | null;
  recentDeltaRuns: CardhedgerPriceDeltaImportRun[];
  recentCsvRuns: CardhedgerDailyPriceExportRun[];
  activeSubscriptions: number;
  cronEnv: NodeJS.ProcessEnv;
}) {
  const subscribeAvailable =
    Boolean(input.clientId) && input.flags.priceSubscribeEnabled;
  return {
    mode: subscribeAvailable ? 'subscribe_and_poll' : 'delta_poll_only',
    flags: {
      priceWebhookEnabled: input.flags.priceWebhookEnabled,
      priceSubscribeEnabled: input.flags.priceSubscribeEnabled,
      dailyPriceDeltaImportEnabled: input.flags.dailyPriceDeltaImportEnabled,
      dailyPriceExportCsvEnabled: input.flags.dailyPriceExportCsvEnabled,
    },
    webhookUrl: input.frontendUrl
      ? `${input.frontendUrl}/api/webhooks/cardhedger/price-updates`
      : null,
    webhookAuthHeader: 'X-Cardhedger-Webhook-Secret',
    webhookSecretConfigured: input.webhookSecretConfigured,
    clientIdConfigured: Boolean(input.clientId),
    clientIdHint: input.clientId
      ? `${input.clientId.slice(0, Math.min(6, input.clientId.length))}…`
      : null,
    subscribeAvailable,
    deltaCronEnabled: isCardhedgerPriceDeltaCronEnabled(input.cronEnv),
    lastDeltaSince: input.checkpoint?.lastSinceIso ?? null,
    lastDeltaCheckpointAt: input.checkpoint?.updatedAt?.toISOString() ?? null,
    activeSubscriptions: input.activeSubscriptions,
    recentDeltaRuns: input.recentDeltaRuns.map(serializeCardhedgerDeltaRun),
    recentCsvRuns: input.recentCsvRuns.map((run) => ({
      fileDate: run.fileDate,
      source: run.source,
      status: run.status,
      rowCount: run.rowCount,
      errorMessage: run.errorMessage,
      ranAt: run.ranAt.toISOString(),
    })),
  };
}
