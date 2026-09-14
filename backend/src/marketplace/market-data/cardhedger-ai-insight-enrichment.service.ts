import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import { UserWatchlist } from '../entities/user-watchlist.entity';
import { psaCertNumberFromCollectionRow } from '../utils/collection-row.util';
import { compactPsaCertFromComponents } from '../utils/psa-cert-compact.util';
import { hasCompletePsaPopulationByGrade } from '../../psa/psa-spec-population.util';
import type {
  AiInsightEnrichmentContext,
  AiInsightPlatformContext,
  AiInsightPopulationContext,
} from './cardhedger-ai-insight.types';
import { parsePopulationContext } from './cardhedger-ai-insight-population.util';


@Injectable()
export class CardhedgerAiInsightEnrichmentService {
  constructor(
    @InjectRepository(UserWatchlist)
    private readonly watchlistRepo: Repository<UserWatchlist>,
  ) {}

  async watchlistCountForCollection(collectionKey: string): Promise<number> {
    const key = collectionKey.trim().toLowerCase();
    if (!key) return 0;
    return this.watchlistRepo.count({ where: { collectionKey: key } });
  }


  async buildEnrichment(
    col: MarketplaceCollection,
    platform: AiInsightPlatformContext,
    _cardId: string | null,
  ): Promise<AiInsightEnrichmentContext> {
    const cert = psaCertNumberFromCollectionRow(col);
    const psaCertSnapshot = compactPsaCertFromComponents(col.components, cert);
    const watchlistCount = await this.watchlistCountForCollection(
      col.collectionKey,
    );

    const gradeScore =
      typeof col.components?.gradeScore === 'string'
        ? col.components.gradeScore.trim()
        : null;

    return {
      platform,
      watchlistCount,
      psaCertSnapshot,
      listingGradeScore: gradeScore,
    };
  }


  buildPopulationContext(
    components: Record<string, unknown>,
    statsPsa10Pop: number | null,
  ): AiInsightPopulationContext {
    const base = parsePopulationContext(components, statsPsa10Pop);
    return {
      ...base,
      hasCompleteByGrade: hasCompletePsaPopulationByGrade(components),
    };
  }
}
