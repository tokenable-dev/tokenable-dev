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
 * PSA Public API upstream for background jobs (snapshot refresh, listing enrichment).
 * Off by default; set `PSA_PUBLIC_API_BACKGROUND_UPSTREAM=true` to enable.
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

/** Snapshot refresh may call PSA Public API when upstream is on and refresh env allows it. */
export function isPsaPublicApiSnapshotUpstreamEnabled(
  config: ConfigService,
  refreshOnSnapshotEnv: string | undefined,
): boolean {
  if (!isPsaPublicApiUpstreamEnabled(config)) return false;
  const v = (refreshOnSnapshotEnv ?? '').trim().toLowerCase();
  if (v === 'always' || v === 'true' || v === '1') return true;
  return isPsaPublicApiBackgroundUpstreamEnabled(config);
}
