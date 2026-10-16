import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketplaceCollection } from '../marketplace/entities/marketplace-collection.entity';
import { PsaPublicApiService, normalizePsaSpecId } from './psa-public-api.service';
import {
  hasCompletePsaPopulationByGrade,
  psaPopulationByGradeRecord,
  type PsaPopulationByGrade,
} from './psa-spec-population.util';

/** Durable SpecID-keyed pop snapshot for collection components. */
export type PsaSpecPopulationCapture = {
  specId: string;
  byGrade: Record<string, number>;
  grade10: number;
  total: number;
  /** `components_cache` = reused from another collection; `psa_api` = upstream call. */
  source: 'components_cache' | 'psa_api';
};

/**
 * Collection-create PSA Spec Population capture.
 * At most one GetPSASpecPopulation per SpecID when no complete Grade1–10
 * snapshot exists yet on any marketplace_collections.components row.
 */
@Injectable()
export class PsaSpecPopulationCaptureService {
  private readonly logger = new Logger(PsaSpecPopulationCaptureService.name);

  constructor(
    private readonly psaPublicApi: PsaPublicApiService,
    @InjectRepository(MarketplaceCollection)
    private readonly collections: Repository<MarketplaceCollection>,
  ) {}

  /**
   * Resolve complete Spec population for collection components.
   * Prefer sibling collection components; otherwise call PSA once.
   */
  async captureForSpecId(specRaw: unknown): Promise<PsaSpecPopulationCapture | null> {
    const specId = normalizePsaSpecId(specRaw);
    if (!specId) return null;

    const cached = await this.findCompleteInComponents(specId);
    if (cached) {
      this.logger.debug(
        `PSA spec pop reuse from components specId=${specId}`,
      );
      return { ...cached, source: 'components_cache' };
    }

    const lookup = await this.psaPublicApi.getSpecPopulation(specId);
    if (lookup.status !== 'success') {
      if (lookup.status === 'error') {
        this.logger.warn(
          `PSA spec pop capture failed specId=${specId}: ${lookup.message}`,
        );
      } else {
        this.logger.debug(
          `PSA spec pop capture skipped specId=${specId}: ${lookup.reason}`,
        );
      }
      return null;
    }

    const byGradeRecord = psaPopulationByGradeRecord(lookup.pop.byGrade);
    const total = lookup.pop.total;
    const grade10 = lookup.pop.grade10;
    if (
      !byGradeRecord ||
      total == null ||
      !Number.isFinite(total) ||
      total < 0 ||
      grade10 == null ||
      !Number.isFinite(grade10) ||
      grade10 < 0
    ) {
      this.logger.warn(
        `PSA spec pop capture incomplete specId=${specId}`,
      );
      return null;
    }

    this.logger.log(
      `PSA spec pop capture ok specId=${specId} total=${total} grade10=${grade10}`,
    );
    return {
      specId,
      byGrade: byGradeRecord,
      grade10: Math.floor(grade10),
      total: Math.floor(total),
      source: 'psa_api',
    };
  }

  private async findCompleteInComponents(
    specId: string,
  ): Promise<Omit<PsaSpecPopulationCapture, 'source'> | null> {
    const rows = await this.collections
      .createQueryBuilder('c')
      .where(`c.components->>'psaSpecId' = :specId`, { specId })
      .take(30)
      .getMany();

    for (const row of rows) {
      const comp = (row.components ?? {}) as Record<string, unknown>;
      if (!hasCompletePsaPopulationByGrade(comp)) continue;
      const byGrade = psaPopulationByGradeRecord(
        comp.psaPopulationByGrade as PsaPopulationByGrade,
      );
      const total = comp.psaSpecTotalPopulation;
      const grade10 =
        typeof comp.psaGrade10Population === 'number'
          ? comp.psaGrade10Population
          : byGrade?.['10'];
      if (
        !byGrade ||
        typeof total !== 'number' ||
        !Number.isFinite(total) ||
        total < 0 ||
        typeof grade10 !== 'number' ||
        !Number.isFinite(grade10) ||
        grade10 < 0
      ) {
        continue;
      }
      return {
        specId,
        byGrade,
        grade10: Math.floor(grade10),
        total: Math.floor(total),
      };
    }
    return null;
  }
}
