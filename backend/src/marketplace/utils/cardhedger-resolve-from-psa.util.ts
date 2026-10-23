import { catalogTcgPrefixedNumberCompatible } from './card-match.util';
import {
  cardhedgerCatalogVariantSpecificity,
  cardhedgerCertRowRelaxedGemRateLink,
  cardhedgerCertRowUsableForPsaVariety,
  cardhedgerRowMatchesPsaVariety,
  psaVarietyHasNamedCollectibleIdentity,
} from './cardhedger-psa-variety.util';
import { orderedPsaCardhedgerSearchQueries } from './psa-cardhedger-search.util';

export type PsaCardhedgerResolveHints = {
  psaSubject?: string | null;
  psaBrand?: string | null;
  psaYear?: string | null;
  cardNumber?: string | null;
  cardName?: string | null;
  cardSet?: string | null;
  psaVariety?: string | null;
};

export type PsaCardhedgerResolvedCatalog = {
  cardId: string;
  imageUrl: string;
  searchQuery: string;
  row: Record<string, unknown>;
};

function normCompact(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Pick the best Cardhedger search hit for PSA cert fields (Variety gate + specificity).
 */
export function pickCardhedgerRowFromSearchResults(
  cards: readonly Record<string, unknown>[],
  hints: PsaCardhedgerResolveHints,
): PsaCardhedgerResolvedCatalog | null {
  const cardName = String(hints.cardName ?? hints.psaSubject ?? '').trim();
  const cardNumber = String(hints.cardNumber ?? '')
    .replace(/^#/, '')
    .trim();
  const psaVariety = String(hints.psaVariety ?? '').trim();
  const requireNamed = psaVarietyHasNamedCollectibleIdentity(psaVariety);

  const wantNum = normCompact(cardNumber).replace(/^#/, '');
  const wantNameWords = normCompact(cardName).match(/[a-z0-9]+/g) ?? [];

  let bestCompatible: Record<string, unknown> | null = null;
  let bestCompatibleSpec = -1;
  let bestNameNum: Record<string, unknown> | null = null;
  let bestFirst: Record<string, unknown> | null = null;

  for (const row of cards) {
    const id = typeof row.card_id === 'string' ? row.card_id.trim() : '';
    if (!id) continue;
    if (!bestFirst) bestFirst = row;
    const rowNum = normCompact(String(row.number ?? '')).replace(/^#/, '');
    const rowDesc = normCompact(String(row.description ?? row.name ?? ''));
    const numOk =
      !wantNum ||
      rowNum === wantNum ||
      catalogTcgPrefixedNumberCompatible(cardNumber, String(row.number ?? ''));
    const nameOk =
      wantNameWords.length === 0 ||
      wantNameWords.every((w) => rowDesc.includes(w));
    if (!(numOk && nameOk)) continue;
    if (!bestNameNum) bestNameNum = row;
    if (!cardhedgerRowMatchesPsaVariety(row, psaVariety)) continue;
    const spec = cardhedgerCatalogVariantSpecificity(row, psaVariety);
    if (spec > bestCompatibleSpec) {
      bestCompatible = row;
      bestCompatibleSpec = spec;
    }
  }

  const best =
    bestCompatible ?? (requireNamed ? null : (bestNameNum ?? bestFirst));
  if (!best) return null;
  const cardId = String(best.card_id ?? '').trim();
  if (!cardId) return null;
  const imageUrl =
    typeof best.image === 'string' ? best.image.trim() : '';
  return { cardId, imageUrl, searchQuery: '', row: best };
}

export function cardhedgerCertCatalogRowUsable(
  card: Record<string, unknown> | null | undefined,
  psaVariety: string | null | undefined,
): boolean {
  if (!card) return false;
  if (cardhedgerCertRowUsableForPsaVariety(card, psaVariety)) return true;
  return cardhedgerCertRowRelaxedGemRateLink(card, psaVariety);
}

export function cardhedgerCatalogFromCertCard(
  card: Record<string, unknown>,
  fallbackSearchQuery: string,
): Omit<PsaCardhedgerResolvedCatalog, 'searchQuery'> & { searchQuery: string } {
  const id =
    typeof card.card_id === 'string' && card.card_id.trim()
      ? card.card_id.trim()
      : '';
  const searchQuery =
    (typeof card.description === 'string' && card.description.trim()
      ? card.description.trim()
      : typeof card.name === 'string' && card.name.trim()
        ? card.name.trim()
        : null) ?? fallbackSearchQuery;
  const imageUrl =
    typeof card.image === 'string' && card.image.trim()
      ? card.image.trim()
      : '';
  return { cardId: id, imageUrl, searchQuery, row: card };
}

/** PSA-forward search strings (Variety before GemRate cert description). */
export function psaCardhedgerSearchQueryList(
  hints: PsaCardhedgerResolveHints,
  opts?: { certDescription?: string | null; cardhedgerSearchQuery?: string | null },
): string[] {
  return orderedPsaCardhedgerSearchQueries(hints, opts);
}
