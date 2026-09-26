import type {
  CardhedgerDeltaImportMatchedCollection,
} from '../entities/cardhedger-price-delta-import-run.entity';
import type { CardhedgerPriceUpdatePayload } from './cardhedger-price-external-id.util';

const MATCHED_COLLECTION_LIMIT = 200;

function strField(raw: Record<string, unknown>, key: string): string | null {
  const v = raw[key];
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

export function enrichPriceUpdate(
  u: CardhedgerPriceUpdatePayload,
): CardhedgerPriceUpdatePayload {
  const raw = u as Record<string, unknown>;
  return {
    ...u,
    card_desc: strField(raw, 'card_desc') ?? undefined,
    player: strField(raw, 'player') ?? undefined,
    card_set: strField(raw, 'card_set') ?? undefined,
  };
}

export type DeltaImportSummary = {
  sinceIso: string;
  latestTimestampIso: string | null;
  updateCount: number;
  uniqueCardIds: number;
  /** Delta card_id hits on our catalog. */
  deltaMatchedCollectionCount: number;
  /** Extra collections refreshed because delta had no catalog overlap. */
  catalogFallbackCount: number;
  /** Total unique collections enqueued (delta + fallback). */
  matchedCollectionCount: number;
  unmatchedUpdateCount: number;
  enqueuedCollectionKeys: string[];
  matchedCollections: CardhedgerDeltaImportMatchedCollection[];
};

export function buildDeltaImportSummary(input: {
  sinceIso: string;
  updates: CardhedgerPriceUpdatePayload[];
  cardIdToCollectionKeys: Map<string, string[]>;
}): DeltaImportSummary {
  const { sinceIso, updates, cardIdToCollectionKeys } = input;

  const collectionKeys = new Set<string>();
  const matchedByKey = new Map<string, CardhedgerDeltaImportMatchedCollection>();
  const uniqueCardIds = new Set<string>();
  let unmatchedUpdateCount = 0;
  let latestTimestampIso: string | null = null;

  for (const raw of updates) {
    const enriched = enrichPriceUpdate(raw);
    const cardId = String(enriched.card_id ?? '').trim();
    const grade = strField(enriched as Record<string, unknown>, 'grade');
    const price = strField(enriched as Record<string, unknown>, 'price');
    const cardDesc = enriched.card_desc ?? null;
    const updateTimestamp = strField(enriched as Record<string, unknown>, 'update_timestamp');

    if (updateTimestamp && (!latestTimestampIso || updateTimestamp > latestTimestampIso)) {
      latestTimestampIso = updateTimestamp;
    }

    if (cardId) uniqueCardIds.add(cardId);

    const matchedKeys = cardId
      ? (cardIdToCollectionKeys.get(cardId.trim().toLowerCase()) ?? [])
      : [];
    if (matchedKeys.length === 0) {
      unmatchedUpdateCount++;
    } else {
      for (const key of matchedKeys) {
        collectionKeys.add(key);
        const prev = matchedByKey.get(key);
        const row: CardhedgerDeltaImportMatchedCollection = {
          collectionKey: key,
          cardId,
          grade,
          price,
          cardDesc,
          updateTimestamp,
        };
        if (
          !prev ||
          (updateTimestamp && (!prev.updateTimestamp || updateTimestamp > prev.updateTimestamp))
        ) {
          matchedByKey.set(key, row);
        }
      }
    }
  }

  const matchedCollections = [...matchedByKey.values()]
    .sort((a, b) => a.collectionKey.localeCompare(b.collectionKey))
    .slice(0, MATCHED_COLLECTION_LIMIT);

  const enqueuedCollectionKeys = [...collectionKeys].sort();
  const deltaMatchedCollectionCount = enqueuedCollectionKeys.length;

  return {
    sinceIso,
    latestTimestampIso,
    updateCount: updates.length,
    uniqueCardIds: uniqueCardIds.size,
    deltaMatchedCollectionCount,
    catalogFallbackCount: 0,
    matchedCollectionCount: deltaMatchedCollectionCount,
    unmatchedUpdateCount,
    enqueuedCollectionKeys,
    matchedCollections,
  };
}
