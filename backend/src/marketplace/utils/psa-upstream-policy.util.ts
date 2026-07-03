import type { ConfigService } from '@nestjs/config';

/**
 * Master switch for live PSA Public API HTTP calls.
 * Default **on** when `PSA_PUBLIC_API_TOKEN` is set. Set `PSA_PUBLIC_API_UPSTREAM_ENABLED=false` to disable.
 */
export function isPsaPublicApiUpstreamEnabled(
  config: ConfigService,
): boolean {
  const v = config.get<string>('PSA_PUBLIC_API_UPSTREAM_ENABLED');
  if (v === 'false' || v === '0' || v === 'never') return false;
  if (v === 'true' || v === '1' || v === 'always') return true;
  const token = config.get<string>('PSA_PUBLIC_API_TOKEN')?.replace(/\s+/g, '');
  return Boolean(token?.length);
}

/**
 * PSA Public API upstream is **user-initiated only** (`POST /psa/analyze-by-cert`,
 * `POST /psa/analyze` with cert). Background jobs and collection reads use DB cache.
 *
 * Legacy env flags are ignored unless explicitly set to force background (discouraged).
 */
export function isPsaPublicApiBackgroundUpstreamEnabled(
  config: ConfigService,
): boolean {
  const v = config.get<string>('PSA_PUBLIC_API_BACKGROUND_UPSTREAM');
  if (v === 'true' || v === '1' || v === 'always') return true;
  return false;
}

/** @deprecated Mint/listing paths no longer call PSA upstream — kept for env compat. */
export function isPsaPublicApiMintUpstreamEnabled(
  _config: ConfigService,
): boolean {
  return false;
}

/** Snapshot refresh must never call PSA Public API (use `psa_cert_snapshots` cache). */
export function isPsaPublicApiSnapshotUpstreamEnabled(
  _config: ConfigService,
  _refreshOnSnapshotEnv: string | undefined,
): boolean {
  return false;
}
