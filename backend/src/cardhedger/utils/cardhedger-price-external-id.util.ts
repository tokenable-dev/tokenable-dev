/** Prefix for Cardhedger subscribe-price-updates `external_id` → collection key mapping. */
export const CARDHEDGER_PRICE_EXTERNAL_ID_PREFIX = 'tokenable:';

export function buildPriceSubscriptionExternalId(collectionKey: string): string {
  const key = collectionKey.trim().toLowerCase();
  return `${CARDHEDGER_PRICE_EXTERNAL_ID_PREFIX}${key}`;
}

export function parsePriceSubscriptionExternalId(
  externalId: string | null | undefined,
): string | null {
  const raw = String(externalId ?? '').trim();
  if (!raw) return null;
  if (raw.startsWith(CARDHEDGER_PRICE_EXTERNAL_ID_PREFIX)) {
    const key = raw.slice(CARDHEDGER_PRICE_EXTERNAL_ID_PREFIX.length).trim();
    return key.length > 0 ? key.toLowerCase() : null;
  }
  return raw.toLowerCase();
}

export type CardhedgerPriceUpdatePayload = {
  card_id?: string;
  grade?: string;
  price?: string;
  external_id?: string;
  update_timestamp?: string;
  card_desc?: string;
  player?: string;
  card_set?: string;
};

export function normalizePriceWebhookUpdates(body: unknown): CardhedgerPriceUpdatePayload[] {
  if (body == null) return [];
  if (Array.isArray(body)) {
    return body.filter((x): x is CardhedgerPriceUpdatePayload => typeof x === 'object' && x != null);
  }
  if (typeof body !== 'object') return [];
  const obj = body as Record<string, unknown>;
  if (Array.isArray(obj.updates)) {
    return obj.updates.filter(
      (x): x is CardhedgerPriceUpdatePayload => typeof x === 'object' && x != null,
    );
  }
  if (typeof obj.card_id === 'string' || typeof obj.external_id === 'string') {
    return [obj as CardhedgerPriceUpdatePayload];
  }
  return [];
}
