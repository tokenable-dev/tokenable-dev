import {
  psaVarietyRequiresNonBaseCardhedgerRow,
} from '../../psa/psa-variety-catalog.util';

function rowParallelBlob(row: Record<string, unknown>): string {
  return [row.variant, row.description, row.name, row.set, row.set_type]
    .map((x) => String(x ?? ''))
    .join(' ')
    .toLowerCase();
}

function varietyMatchChunks(psaVariety: string): string[] {
  const v = psaVariety.trim().toLowerCase();
  const parts = v
    .split(/[\s.\-/]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
  const out = new Set(parts);
  if ([...out].some((p) => p === 'grn' || p.includes('grn'))) {
    out.add('green');
    out.delete('grn');
  }
  if ([...out].some((p) => p.includes('gems') || p === 'metal' || p === 'prec')) {
    out.add('precious');
    out.add('metal');
    out.add('gems');
    out.delete('prec');
  }
  if ([...out].some((p) => p.includes('champ'))) out.add('championship');
  return [...out].filter((c) => c.length >= 2);
}

/** Cardhedger catalog row compatible with PSA PSACert.Variety (PSA is authoritative). */
export function cardhedgerRowMatchesPsaVariety(
  row: Record<string, unknown>,
  psaVariety: string | null | undefined,
): boolean {
  const pv = String(psaVariety ?? '').trim();
  if (!pv) return true;
  if (!psaVarietyRequiresNonBaseCardhedgerRow(pv)) return true;

  const blob = rowParallelBlob(row);
  const v = pv.toLowerCase();
  if (blob.includes(v)) return true;

  const chunks = varietyMatchChunks(v);
  if (chunks.length === 0) return true;
  return chunks.every((c) => blob.includes(c));
}
