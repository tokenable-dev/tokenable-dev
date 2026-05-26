import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  compactFromApiRaw(raw: unknown): Record<string, unknown> | null {
    if (!raw || typeof raw !== 'object') return null;
    const c = (raw as { PSACert?: PsaCertRecord }).PSACert;
    if (!c || typeof c !== 'object') return null;
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
    const snap = this.compactFromApiRaw(lookup.raw);
    if (!snap || Object.keys(snap).length === 0) return;
    await this.repo.save({
      certNumber: cert,
      snapshotJson: snap,
      fetchedAt: new Date(),
    });
  }
}
