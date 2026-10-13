import { cardNumberTokenForCardhedgerSearch } from './card-match.util';
import { normalizePsaVarietyForMatch } from './cardhedger-psa-variety.util';
import { psaVarietyRequiresNonBaseCardhedgerRow } from '../../psa/psa-variety-catalog.util';
import { varietyHintsForSearch } from '../../psa/utils/psa-ocr.util';

export type PsaCardhedgerSearchHints = {
  psaSubject?: string | null;
  psaBrand?: string | null;
  psaYear?: string | null;
  cardNumber?: string | null;
  cardName?: string | null;
  cardSet?: string | null;
  /** PSA `PSACert.Variety` — authoritative parallel line (use as-is after trim). */
  psaVariety?: string | null;
};

/**
 * Ordered Cardhedger `card-search` strings with **PSA cert fields first**.
 * GemRate `cert_info.description` is secondary — it can omit parallels (e.g. Refractor).
 */
export function orderedPsaCardhedgerSearchQueries(
  hints: PsaCardhedgerSearchHints,
  opts?: {
    certDescription?: string | null;
    cardhedgerSearchQuery?: string | null;
  },
): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const push = (s: unknown) => {
    const t = String(s ?? '').trim();
    if (t.length < 2) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    ordered.push(t);
  };

  const varietyRaw = String(hints.psaVariety ?? '').trim();
  const brand = String(hints.psaBrand ?? hints.cardSet ?? '').trim();
  const subject = String(hints.psaSubject ?? hints.cardName ?? '').trim();
  const year = String(hints.psaYear ?? '').trim();
  const num = hints.cardNumber
    ? cardNumberTokenForCardhedgerSearch(String(hints.cardNumber))
    : '';

  const join = (...parts: (string | undefined)[]) =>
    parts
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();

  if (
    varietyRaw &&
    psaVarietyRequiresNonBaseCardhedgerRow(varietyRaw, brand || null)
  ) {
    push(join(subject, brand, year, num, varietyRaw));
    push(join(subject, num, varietyRaw, brand));
    push(join(brand, year, num, varietyRaw));
    const normalized = normalizePsaVarietyForMatch(varietyRaw);
    if (
      normalized &&
      normalized.toLowerCase() !== varietyRaw.toLowerCase()
    ) {
      push(join(subject, brand, year, num, normalized));
    }
    for (const vh of varietyHintsForSearch(varietyRaw)) {
      push(join(subject, brand, year, num, vh));
      push(join(subject, num, vh, brand));
    }
  }

  push(
    join(
      subject,
      brand,
      year,
      num,
      ...varietyHintsForSearch(varietyRaw),
    ),
  );
  push(join(subject, brand, year, num));
  push(join(subject, brand, num));

  const cert = String(opts?.certDescription ?? '').trim();
  if (cert) push(cert);
  const stored = String(opts?.cardhedgerSearchQuery ?? '').trim();
  if (stored && stored.toLowerCase() !== cert.toLowerCase()) push(stored);

  return ordered;
}
