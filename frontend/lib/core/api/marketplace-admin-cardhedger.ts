import { backendFetch, getApiUrl } from "./client";

async function parseAdminError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({}));
  throw new Error((err as { message?: string }).message ?? fallback);
}

export type DeltaImportMatchedCollection = {
  collectionKey: string;
  cardId: string;
  grade: string | null;
  price: string | null;
  cardDesc: string | null;
  updateTimestamp: string | null;
};

export type DeltaImportRun = {
  id: number;
  ranAt: string;
  sinceIso: string;
  latestTimestampIso: string | null;
  updateCount: number;
  uniqueCardIds: number;
  matchedCollectionCount: number;
  deltaMatchedCollectionCount: number;
  catalogFallbackCount: number;
  unmatchedUpdateCount: number;
  enqueuedCollectionKeys: string[];
  matchedCollections: DeltaImportMatchedCollection[];
  status: string;
  errorMessage: string | null;
};

export type CardhedgerPriceInfraStatus = {
  mode: "delta_poll_only" | "subscribe_and_poll";
  flags: {
    priceWebhookEnabled: boolean;
    priceSubscribeEnabled: boolean;
    dailyPriceDeltaImportEnabled: boolean;
    dailyPriceExportCsvEnabled: boolean;
  };
  webhookUrl: string | null;
  webhookAuthHeader: string;
  webhookSecretConfigured: boolean;
  clientIdConfigured: boolean;
  clientIdHint: string | null;
  subscribeAvailable: boolean;
  deltaCronEnabled: boolean;
  lastDeltaSince: string | null;
  lastDeltaCheckpointAt: string | null;
  activeSubscriptions: number;
  recentDeltaRuns: DeltaImportRun[];
  recentCsvRuns: Array<{
    fileDate: string;
    source: string;
    status: string;
    rowCount: number | null;
    errorMessage: string | null;
    ranAt: string;
  }>;
};

export type RunDeltaImportResult =
  | { ok: false; skipped: "in_flight" }
  | {
      ok: true;
      fileDate: string;
      csv: { status: string } | null;
      delta: DeltaImportRun | null;
    };

export async function getCardhedgerPriceInfraStatus(): Promise<CardhedgerPriceInfraStatus> {
  const res = await backendFetch(
    `${getApiUrl()}/admin/cardhedger/price-subscriptions/status`,
  );
  if (!res.ok) {
    await parseAdminError(res, "Failed to load price infra status");
  }
  return res.json() as Promise<CardhedgerPriceInfraStatus>;
}

export async function runCardhedgerDeltaImport(): Promise<RunDeltaImportResult> {
  const res = await backendFetch(
    `${getApiUrl()}/admin/cardhedger/price-subscriptions/nightly-delta/run`,
    { method: "POST" },
  );
  if (!res.ok) {
    await parseAdminError(res, "Delta import failed");
  }
  return res.json() as Promise<RunDeltaImportResult>;
}
