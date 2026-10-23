/**
 * Portfolio Line 1 from IPFS graded metadata: `{Name} · #{Number} · PSA {score}`.
 * Prefer this over thin OpenSea `metadata.name` (often bare card subject).
 */
export function listReadyDisplayNameFromGradedMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!metadata) return null;
  const props = metadata.properties as Record<string, unknown> | undefined;
  const graded = (props?.graded ?? metadata.graded) as
    | Record<string, unknown>
    | undefined;
  if (!graded || typeof graded !== 'object') return null;

  const psa = graded.psa as Record<string, unknown> | undefined;
  const card = graded.card as Record<string, unknown> | undefined;
  const gradeObj = graded.grade as Record<string, unknown> | undefined;

  const cardName = [
    psa?.subject,
    card?.name,
    psa?.cardNameHint,
    typeof metadata.name === 'string' ? metadata.name : null,
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .find(Boolean);
  if (!cardName) return null;

  const cleanedName = cardName
    .replace(/\s*[·•]\s*Raw\s*$/i, '')
    .replace(/\s+Raw\s*$/i, '')
    .replace(/\s*[·•]\s*PSA\s+\d{1,2}(?:\.\d+)?\s*$/i, '')
    .replace(/\s+PSA\s+\d{1,2}(?:\.\d+)?\s*$/i, '')
    .trim();
  if (!cleanedName) return null;

  const cardNumber = [card?.number, psa?.cardNumberHint]
    .map((v) => (typeof v === 'string' ? v.trim().replace(/^#/, '') : ''))
    .find(Boolean);

  let gradeScore: number | null = null;
  for (const raw of [psa?.gradeScore, gradeObj?.score]) {
    const n =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string'
          ? Number(raw.trim())
          : NaN;
    if (Number.isFinite(n) && n >= 1 && n <= 10) {
      gradeScore = Math.floor(n);
      break;
    }
  }
  if (gradeScore == null) {
    const label = [psa?.gradeLabel, gradeObj?.label]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .find(Boolean);
    const m = label?.match(/\b(\d{1,2}(?:\.\d+)?)\b/);
    if (m?.[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 1 && n <= 10) gradeScore = Math.floor(n);
    }
  }

  const segments = [cleanedName];
  if (cardNumber) {
    segments.push(cardNumber.startsWith('#') ? cardNumber : `#${cardNumber}`);
  }
  if (gradeScore != null) segments.push(`PSA ${gradeScore}`);
  return segments.join(' · ');
}

/** Strip Raw / prefer graded Line 1 for registry + heal writes. */
export function resolveRegistryDisplayName(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  const rebuilt = listReadyDisplayNameFromGradedMetadata(metadata);
  if (rebuilt) return rebuilt;
  if (typeof metadata?.name !== 'string') return null;
  const name = metadata.name
    .trim()
    .replace(/\s*[·•]\s*Raw\s*$/i, '')
    .replace(/\s+Raw\s*$/i, '')
    .trim();
  return name || null;
}
