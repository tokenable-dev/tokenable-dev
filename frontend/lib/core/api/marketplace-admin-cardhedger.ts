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

export type CardhedgerPriceSubscriptionRow = {
  collectionKey: string;
  cardId: string;
  grade: string;
  externalId: string;
  active: boolean;
  upstreamSuccess: boolean | null;
  upstreamError: string | null;
  subscribedAt: string;
  lastWebhookAt: string | null;
  deactivatedAt: string | null;
};

export type SubscribeCollectionResult = {
  collectionKey: string;
  subscribed: boolean;
  skipped?: string;
  error?: string;
};

export type SyncSubscriptionsResult = {
  attempted: number;
  subscribed: number;
  skipped: number;
  errors: number;
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

export async function listCardhedgerPriceSubscriptions(params?: {
  limit?: number;
  offset?: number;
  activeOnly?: boolean;
}): Promise<{ items: CardhedgerPriceSubscriptionRow[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  if (params?.activeOnly) qs.set("active", "true");
  const query = qs.toString();
  const res = await backendFetch(
    `${getApiUrl()}/admin/cardhedger/price-subscriptions${query ? `?${query}` : ""}`,
  );
  if (!res.ok) {
    await parseAdminError(res, "Failed to load subscriptions");
  }
  return res.json() as Promise<{ items: CardhedgerPriceSubscriptionRow[]; total: number }>;
}

export async function syncCardhedgerPriceSubscriptions(
  limit = 500,
): Promise<SyncSubscriptionsResult> {
  const res = await backendFetch(
    `${getApiUrl()}/admin/cardhedger/price-subscriptions/sync`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit }),
    },
  );
  if (!res.ok) {
    await parseAdminError(res, "Sync failed");
  }
  return res.json() as Promise<SyncSubscriptionsResult>;
}

export async function subscribeCardhedgerCollection(
  collectionKey: string,
): Promise<SubscribeCollectionResult> {
  const enc = encodeURIComponent(collectionKey);
  const res = await backendFetch(
    `${getApiUrl()}/admin/cardhedger/price-subscriptions/${enc}`,
    { method: "POST" },
  );
  if (!res.ok) {
    await parseAdminError(res, "Subscribe failed");
  }
  return res.json() as Promise<SubscribeCollectionResult>;
}

export async function unsubscribeCardhedgerCollection(
  collectionKey: string,
): Promise<{ ok: true }> {
  const enc = encodeURIComponent(collectionKey);
  const res = await backendFetch(
    `${getApiUrl()}/admin/cardhedger/price-subscriptions/${enc}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    await parseAdminError(res, "Unsubscribe failed");
  }
  return res.json() as Promise<{ ok: true }>;
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
