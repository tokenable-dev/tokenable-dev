import { mergePsaVarietyWithMintVariant } from '../../psa/psa-variety-catalog.util';
import type { SnapshotRefreshReason } from './market-snapshot.types';

/** Merge compact `psa_cert_snapshots.snapshot_json` into collection `components` PSA mirrors. */
export function mergePsaCertSnapshotIntoMirror(
  baseMirror: Record<string, unknown>,
  snap: Record<string, unknown>,
): Record<string, unknown> {
  const extra: Record<string, unknown> = { ...baseMirror };
  const apply = (key: string, raw: unknown) => {
    const v = String(raw ?? '').trim();
    if (!v) return;
    if (String(extra[key] ?? '').trim()) return;
    extra[key] = v;
  };
  apply('psaSubject', snap.Subject);
  apply('psaBrand', snap.Brand);
  apply('psaYear', snap.Year);
  const snapVariety = String(snap.Variety ?? '').trim();
  if (snapVariety) {
    const existing = String(extra.psaVariety ?? '').trim();
    const mintV = String(extra.mintCardVariant ?? '').trim();
    extra.psaVariety = mergePsaVarietyWithMintVariant(
      snapVariety,
      mergePsaVarietyWithMintVariant(existing, mintV),
    );
  }
  const cn = String(snap.CardNumber ?? '').trim();
  if (cn && !String(extra.cardNumber ?? '').trim()) {
    extra.cardNumber = cn.replace(/^#/, '');
  }

  // Optional: PSA Estimate USD (fallback market price when Cardhedger is missing comps).
  const estimateRaw =
    snap.EstimateUsd ?? snap.Estimate ?? snap.PsaEstimateUsd ?? snap.PsaEstimate;
  const estimateN =
    typeof estimateRaw === 'number' && Number.isFinite(estimateRaw)
      ? estimateRaw
      : typeof estimateRaw === 'string'
        ? Number(
            (estimateRaw ?? '')
              .replace(/,/g, '')
              .replace(/\$/g, '')
              .match(/(\d+(?:\.\d+)?)/)?.[1] ?? NaN,
          )
        : NaN;
  if (Number.isFinite(estimateN) && estimateN > 0 && extra.psaEstimateUsd == null) {
    extra.psaEstimateUsd = estimateN;
  }
  return extra;
}

/**
 * Enough PSA mirror fields for Cardhedger resolve without hitting Public API.
 * Matches {@link CardhedgerMarketDataService.enrichPsaMirrorFromCertLookup} completeness check.
 */
export function componentsPsaMirrorSufficientForCardhedger(
  components: Record<string, unknown> | null | undefined,
): boolean {
  if (!components || typeof components !== 'object') return false;
  const variety = String(components.psaVariety ?? '').trim();
  const subject = String(components.psaSubject ?? '').trim();
  const brand = String(components.psaBrand ?? '').trim();
  return Boolean(variety && subject && brand);
}

/**
 * When false, snapshot refresh may only read `psa_cert_snapshots` — no upstream PSA calls.
 * Default: only `cold_start` and `manual` (user-driven), not cron/stale_swr/prewarm.
 */
export function psaPublicApiAllowedForSnapshotReason(
  reason: SnapshotRefreshReason,
  configValue: string | undefined,
): boolean {
  const mode = (configValue ?? 'manual').trim().toLowerCase();
  if (mode === 'always' || mode === '1' || mode === 'true') return true;
  if (mode === 'never' || mode === '0' || mode === 'false') return false;
  return reason === 'cold_start' || reason === 'manual';
}
