import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
  PsaPublicApiService,
  type PsaCertRecord,
} from '../../psa/psa-public-api.service';
import { PsaCertSnapshot } from '../entities/psa-cert-snapshot.entity';

/**
 * Single gateway for PSA Public API cert lookups — all callers should use this
 * instead of {@link PsaPublicApiService.getByCertNumber} directly.
 */
/** Full PSA `GetByCertNumber` JSON stored inside `snapshot_json` for repeat lookups. */
export const PSA_OFFICIAL_API_RAW_SNAPSHOT_KEY = '__officialApiRaw';

@Injectable()
export class PsaCertSnapshotService {
  private readonly logger = new Logger(PsaCertSnapshotService.name);

  /** Strip internal-only keys before returning snapshot JSON to callers. */
  static stripInternalSnapshotKeys(
    snap: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> | null {
    if (!snap || typeof snap !== 'object') return null;
    const { [PSA_OFFICIAL_API_RAW_SNAPSHOT_KEY]: _raw, ...rest } = snap;
    return Object.keys(rest).length > 0 ? rest : null;
  }

  constructor(
    @InjectRepository(PsaCertSnapshot)
    private readonly repo: Repository<PsaCertSnapshot>,
    private readonly psaPublicApi: PsaPublicApiService,
    private readonly config: ConfigService,
  ) {}

  private ttlMs(): number {
    const raw = this.config.get<string>('PSA_PUBLIC_SNAPSHOT_DB_TTL_SEC');
    const sec = Number(raw);
    if (!Number.isFinite(sec) || sec < 60) return 7 * 24 * 3600 * 1000;
    return Math.min(Math.floor(sec), 90 * 24 * 3600) * 1000;
  }

  private parseUsdEstimateFromUnknown(raw: unknown): number | null {
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

  /**
   * Extract PSA estimate USD from PSA Public API raw payload when the field exists.
   */
  private estimateUsdFromAnyRaw(raw: unknown): number | null {
    let found: number | null = null;

    const visit = (node: unknown, keyHint?: string) => {
      if (found != null) return;
      if (node == null) return;

      const hint = (keyHint ?? '').toLowerCase();

      if (typeof node === 'number') {
        if (hint.includes('estimate') && node > 0 && Number.isFinite(node))
          found = node;
        return;
      }

      if (typeof node === 'string') {
        const parsed = this.parseUsdEstimateFromUnknown(node);
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
          const n = this.parseUsdEstimateFromUnknown(v);
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

  /**
   * Returns numeric USD estimate when present in compacted cert snapshot JSON.
   */
  static psaEstimateUsdFromSnapshotJson(
    snap: Record<string, unknown> | null | undefined,
  ): number | null {
    if (!snap) return null;
    const raw = (snap as Record<string, unknown>).EstimateUsd;
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

  compactFromApiRaw(raw: unknown): Record<string, unknown> | null {
    if (!raw || typeof raw !== 'object') return null;
    const c = (raw as { PSACert?: PsaCertRecord }).PSACert;
    if (!c || typeof c !== 'object') return null;
    const estimateUsd = this.estimateUsdFromAnyRaw(raw);
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

  /** Rebuild minimal `GetByCertNumber` body from legacy compact-only snapshot rows. */
  reconstructOfficialApiRawFromCompact(
    snap: Record<string, unknown>,
  ): Record<string, unknown> | null {
    const compact = PsaCertSnapshotService.stripInternalSnapshotKeys(snap);
    if (!compact) return null;
    const subject = String(compact.Subject ?? '').trim();
    const certNumber = String(compact.CertNumber ?? '').trim();
    if (!subject && !certNumber) return null;
    const psaCert: Record<string, unknown> = {};
    for (const key of [
      'CertNumber',
      'SpecID',
      'Subject',
      'Brand',
      'Year',
      'Variety',
      'CardNumber',
      'CardGrade',
      'GradeDescription',
      'Category',
      'TotalPopulation',
    ] as const) {
      const v = compact[key];
      if (v != null && String(v).trim() !== '') psaCert[key] = v;
    }
    if (Object.keys(psaCert).length === 0) return null;
    return {
      IsValidRequest: true,
      PSACert: psaCert,
    };
  }

  async findByCert(certNumber: string): Promise<PsaCertSnapshot | null> {
    const cert = certNumber.trim();
    if (!cert) return null;
    return this.repo.findOne({ where: { certNumber: cert } });
  }

  async getSnapshotJsonIfFresh(
    certNumber: string,
  ): Promise<Record<string, unknown> | null> {
    const row = await this.findByCert(certNumber);
    if (!row?.snapshotJson) return null;
    const age = Date.now() - row.fetchedAt.getTime();
    if (age >= this.ttlMs()) return null;
    return PsaCertSnapshotService.stripInternalSnapshotKeys(row.snapshotJson);
  }

  /**
   * Previously fetched official PSA Public API body (same shape as `GetByCertNumber`).
   * Used to serve repeat Vault cert lookups without another upstream call.
   */
  async getOfficialApiRawIfFresh(certNumber: string): Promise<unknown | null> {
    const cert = certNumber.trim();
    if (!cert) return null;
    const row = await this.findByCert(cert);
    if (!row?.snapshotJson) return null;
    const age = Date.now() - row.fetchedAt.getTime();
    if (age >= this.ttlMs()) return null;
    const raw = row.snapshotJson[PSA_OFFICIAL_API_RAW_SNAPSHOT_KEY];
    if (raw && typeof raw === 'object' && (raw as { PSACert?: unknown }).PSACert) {
      return raw;
    }
    return this.reconstructOfficialApiRawFromCompact(row.snapshotJson);
  }

  /**
   * DB cache first; optional upstream refresh when missing/stale.
   */
  async fetchCertSnapshotJson(
    certNumber: string,
    opts?: { allowUpstream?: boolean },
  ): Promise<Record<string, unknown> | null> {
    const cert = certNumber.trim();
    if (!cert) return null;
    const fresh = await this.getSnapshotJsonIfFresh(cert);
    if (fresh) return fresh;

    if (opts?.allowUpstream === true) {
      await this.refreshIfStale(cert, { allowUpstream: true });
      return this.getSnapshotJsonIfFresh(cert);
    }

    const row = await this.findByCert(cert);
    return (
      PsaCertSnapshotService.stripInternalSnapshotKeys(row?.snapshotJson ?? null) ??
      null
    );
  }

  /**
   * @deprecated PSA upstream is user-initiated only — no background refresh scheduling.
   */
  scheduleRefreshIfNeeded(
    _certNumber: string,
    _reason: 'mint' | 'cert_column_update' = 'cert_column_update',
  ): void {
    return;
  }

  async refreshIfStale(
    certNumber: string,
    opts?: { allowUpstream?: boolean },
  ): Promise<void> {
    if (opts?.allowUpstream !== true) return;
    const cert = certNumber.trim();
    if (!cert) return;
    const existing = await this.findByCert(cert);
    if (
      existing?.snapshotJson &&
      Date.now() - existing.fetchedAt.getTime() < this.ttlMs()
    ) {
      return;
    }
    const lookup = await this.psaPublicApi.getByCertNumber(cert);
    if (lookup.status !== 'success' || !lookup.raw) return;
    let snap = this.compactFromApiRaw(lookup.raw);
    if (!snap || Object.keys(snap).length === 0) return;
    snap = await this.enrichSnapshotWithEstimateIfMissing(snap, cert);
    snap[PSA_OFFICIAL_API_RAW_SNAPSHOT_KEY] = lookup.raw;

    const row: QueryDeepPartialEntity<PsaCertSnapshot> = {
      certNumber: cert,
      snapshotJson: snap as object,
      fetchedAt: new Date(),
    };
    await this.repo.upsert(row, ['certNumber']);
  }

  /** Persist compact snapshot after user-initiated cert lookup (analyze-by-cert). */
  async cacheUserLookupSnapshot(
    certNumber: string,
    apiRaw: unknown,
  ): Promise<void> {
    const cert = certNumber.trim();
    if (!cert) return;
    const snap = this.compactFromApiRaw(apiRaw);
    if (!snap || Object.keys(snap).length === 0) return;
    const payload: Record<string, unknown> = {
      ...snap,
      [PSA_OFFICIAL_API_RAW_SNAPSHOT_KEY]: apiRaw,
    };
    const row: QueryDeepPartialEntity<PsaCertSnapshot> = {
      certNumber: cert,
      snapshotJson: payload as object,
      fetchedAt: new Date(),
    };
    await this.repo.upsert(row, ['certNumber']);
  }

  /**
   * Re-fetch cert snapshot from PSA Public API even when DB TTL is still valid.
   */
  async refreshEstimateIfMissing(
    certNumber: string,
    opts?: { allowUpstream?: boolean },
  ): Promise<number | null> {
    const allowUpstream = opts?.allowUpstream === true;
    const cert = certNumber.trim();
    if (!cert) return null;

    const existing = await this.findByCert(cert);
    const existingEstimate = PsaCertSnapshotService.psaEstimateUsdFromSnapshotJson(
      existing?.snapshotJson ?? null,
    );
    if (existingEstimate != null) return existingEstimate;

    let snap = existing?.snapshotJson ?? null;
    if (!snap || Object.keys(snap).length === 0) {
      if (!allowUpstream) return null;
      await this.refreshIfStale(cert, { allowUpstream: true });
      snap = (await this.findByCert(cert))?.snapshotJson ?? null;
    }
    if (!snap || Object.keys(snap).length === 0) return null;

    const enriched = await this.enrichSnapshotWithEstimateIfMissing(snap, cert);
    const estimate = PsaCertSnapshotService.psaEstimateUsdFromSnapshotJson(enriched);
    if (estimate == null) return null;

    const row: QueryDeepPartialEntity<PsaCertSnapshot> = {
      certNumber: cert,
      snapshotJson: enriched as object,
      fetchedAt: new Date(),
    };
    await this.repo.upsert(row, ['certNumber']);
    return estimate;
  }

  private async enrichSnapshotWithEstimateIfMissing(
    snap: Record<string, unknown>,
    _certNumber: string,
  ): Promise<Record<string, unknown>> {
    return snap;
  }

  /** @deprecated Use {@link refreshEstimateIfMissing}. */
  async refreshIfEstimateMissing(certNumber: string): Promise<void> {
    await this.refreshEstimateIfMissing(certNumber, { allowUpstream: false });
  }
}

export const psaEstimateUsdFromSnapshotJson =
  PsaCertSnapshotService.psaEstimateUsdFromSnapshotJson;
