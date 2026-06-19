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
@Injectable()
export class PsaCertSnapshotService {
  private readonly logger = new Logger(PsaCertSnapshotService.name);

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
    return row.snapshotJson;
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
    if (opts?.allowUpstream === false) return null;
    await this.refreshIfStale(cert);
    return this.getSnapshotJsonIfFresh(cert);
  }

  /** Fire-and-forget upstream refresh when DB row is missing or past TTL. */
  scheduleRefreshIfNeeded(certNumber: string): void {
    void this.refreshIfStale(certNumber).catch((e) =>
      this.logger.debug(`PSA cert snapshot refresh failed: ${String(e)}`),
    );
  }

  async refreshIfStale(certNumber: string): Promise<void> {
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

    const row: QueryDeepPartialEntity<PsaCertSnapshot> = {
      certNumber: cert,
      snapshotJson: snap as object,
      fetchedAt: new Date(),
    };
    await this.repo.upsert(row, ['certNumber']);
  }

  /**
   * Re-fetch cert snapshot from PSA Public API even when DB TTL is still valid.
   */
  async refreshEstimateIfMissing(certNumber: string): Promise<number | null> {
    const cert = certNumber.trim();
    if (!cert) return null;

    const existing = await this.findByCert(cert);
    const existingEstimate = PsaCertSnapshotService.psaEstimateUsdFromSnapshotJson(
      existing?.snapshotJson ?? null,
    );
    if (existingEstimate != null) return existingEstimate;

    let snap = existing?.snapshotJson ?? null;
    if (!snap || Object.keys(snap).length === 0) {
      await this.refreshIfStale(cert);
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
    await this.refreshEstimateIfMissing(certNumber);
  }
}

export const psaEstimateUsdFromSnapshotJson =
  PsaCertSnapshotService.psaEstimateUsdFromSnapshotJson;
