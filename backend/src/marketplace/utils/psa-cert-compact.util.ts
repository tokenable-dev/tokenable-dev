import {
  PsaPublicApiService,
  type PsaCertRecord,
} from '../../psa/psa-public-api.service';

function parseUsdEstimateFromUnknown(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }
  if (typeof raw !== 'string') return null;
  const s = raw.replace(/,/g, '').replace(/\$/g, '').trim();
  if (!s) return null;
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function estimateUsdFromAnyRaw(raw: unknown): number | null {
  let found: number | null = null;

  const visit = (node: unknown, keyHint?: string) => {
    if (found != null) return;
    if (node == null) return;

    const hint = (keyHint ?? '').toLowerCase();

    if (typeof node === 'number') {
      if (hint.includes('estimate') && node > 0 && Number.isFinite(node)) {
        found = node;
      }
      return;
    }

    if (typeof node === 'string') {
      const parsed = parseUsdEstimateFromUnknown(node);
      if (
        parsed != null &&
        (hint.includes('estimate') || /\$\s*\d/.test(node.replace(/\s/g, '')))
      ) {
        found = parsed;
      }
      return;
    }

    if (typeof node !== 'object') return;

    const o = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(o)) {
      if (found != null) return;
      const kHint = keyHint ? `${keyHint}.${k}` : k;
      if (k.toLowerCase().includes('estimate')) {
        const n = parseUsdEstimateFromUnknown(v);
        if (n != null) {
          found = n;
          return;
        }
      }
      visit(v, kHint);
    }
  };

  visit(raw);
  return found;
}

/** Compact PSA GetByCertNumber fields for collection `components` mirror merge. */
export function compactPsaCertFromApiRaw(
  raw: unknown,
): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = (raw as { PSACert?: PsaCertRecord }).PSACert;
  if (!c || typeof c !== 'object') return null;
  const estimateUsd = estimateUsdFromAnyRaw(raw);
  return {
    CertNumber: c.CertNumber,
    SpecID: c.SpecID,
    Subject: c.Subject,
    Brand: c.Brand,
    Year: c.Year ?? c.YearIssued,
    Variety: c.Variety,
    CardNumber: c.CardNumber,
    CardGrade: c.CardGrade,
    GradeDescription: c.GradeDescription,
    Category: c.Category,
    TotalPopulation: c.TotalPopulation,
    ...(estimateUsd != null ? { EstimateUsd: estimateUsd } : {}),
  };
}

export function psaEstimateUsdFromCompact(
  snap: Record<string, unknown> | null | undefined,
): number | null {
  if (!snap) return null;
  const raw = snap.EstimateUsd;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === 'string') {
    const s = raw.replace(/,/g, '').replace(/\$/g, '').trim();
    const m = s.match(/(\d+(?:\.\d+)?)/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

export async function fetchCompactPsaCertByNumber(
  psaPublicApi: PsaPublicApiService,
  certNumber: string,
): Promise<Record<string, unknown> | null> {
  const cert = certNumber.trim();
  if (!cert) return null;
  const lookup = await psaPublicApi.getByCertNumber(cert);
  if (lookup.status !== 'success' || !lookup.raw) return null;
  return compactPsaCertFromApiRaw(lookup.raw);
}

/** Build compact PSA cert fields from persisted collection components (AI insight, etc.). */
export function compactPsaCertFromComponents(
  components: Record<string, unknown> | null | undefined,
  certNumber: string | null,
): Record<string, unknown> | null {
  const cert = certNumber?.trim() || '';
  const comp = components ?? {};
  const out: Record<string, unknown> = {};
  if (cert) out.CertNumber = cert;
  const grade = String(comp.gradeScore ?? '').trim();
  if (grade) out.CardGrade = grade;
  if (Object.keys(out).length === 0) return null;
  return out;
}
