import type { ConfigService } from '@nestjs/config';

/**
 * `CARDHEDGER_PSA_SPECID_MAP` — PSA Public API `SpecID` (string key) → Cardhedger `card_id`.
 * Curated server-side; used by collection resolve and PSA analyze mint payload.
 */
export function readPsaSpecIdCardhedgerMapFromEnvJson(
  raw: string | undefined,
): Map<string, string> {
  const out = new Map<string, string>();
  if (!raw?.trim()) return out;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const [k, v] of Object.entries(parsed)) {
      const kk = String(k).trim();
      const vv = typeof v === 'string' ? v.trim() : '';
      if (!kk || !vv) continue;
      out.set(kk, vv);
    }
  } catch {
    // ignore invalid env JSON
  }
  return out;
}

export function readPsaSpecIdCardhedgerMapFromConfig(
  config: ConfigService,
): Map<string, string> {
  return readPsaSpecIdCardhedgerMapFromEnvJson(
    config.get<string>('CARDHEDGER_PSA_SPECID_MAP'),
  );
}
