import type { ConfigService } from '@nestjs/config';

/**
 * Master switch for live PSA Public API HTTP calls used by **mint** paths
 * (`POST /psa/analyze`, `analyze-by-cert`, partner bulk-mint) and optional admin proxies.
 * Default **on** when `PSA_PUBLIC_API_TOKEN` / tokens are set.
 * Set `PSA_PUBLIC_API_UPSTREAM_ENABLED=false` to disable mint PSA entirely.
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
 * Marketplace / portfolio / snapshot / listing paths must never call PSA.
 * Rate limits are reserved for mint-time analyze only.
 */
export function isPsaPublicApiMarketplaceUpstreamEnabled(): boolean {
  return false;
}

/** Mint analyze / bulk-mint may call PSA when the master upstream switch is on. */
export function isPsaPublicApiMintUpstreamEnabled(
  config: ConfigService,
): boolean {
  return isPsaPublicApiUpstreamEnabled(config);
}

/**
 * Snapshot refresh must never call PSA (mint-only policy).
 * Env `PSA_PUBLIC_API_REFRESH_ON_SNAPSHOT` is ignored.
 */
export function isPsaPublicApiSnapshotUpstreamEnabled(
  _config: ConfigService,
  _refreshOnSnapshotEnv: string | undefined,
): boolean {
  return false;
}
