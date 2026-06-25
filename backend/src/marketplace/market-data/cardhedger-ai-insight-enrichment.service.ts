import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CardTop100DailySnapshot,
  type Top100Card,
} from '../../cardhedger/entities/card-top100-snapshot.entity';
import type { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import { UserWatchlist } from '../entities/user-watchlist.entity';
import { PsaCertSnapshotService } from '../collections/psa-cert-snapshot.service';
import { psaCertNumberFromCollectionRow } from '../utils/collection-row.util';
import { hasCompletePsaPopulationByGrade } from '../../psa/psa-spec-population.util';
import type {
  AiInsightEnrichmentContext,
  AiInsightPlatformContext,
  AiInsightPopulationContext,
  AiInsightTop100RankContext,
} from './cardhedger-ai-insight.types';
import { parsePopulationContext } from './cardhedger-ai-insight-population.util';

function kstToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

function kstDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

@Injectable()
export class CardhedgerAiInsightEnrichmentService {
  constructor(
    @InjectRepository(UserWatchlist)
    private readonly watchlistRepo: Repository<UserWatchlist>,
    @InjectRepository(CardTop100DailySnapshot)
    private readonly top100Repo: Repository<CardTop100DailySnapshot>,
    private readonly psaCertSnapshots: PsaCertSnapshotService,
  ) {}

  async watchlistCountForCollection(collectionKey: string): Promise<number> {
    const key = collectionKey.trim().toLowerCase();
    if (!key) return 0;
    return this.watchlistRepo.count({ where: { collectionKey: key } });
  }

  async top100RankForCard(
    cardId: string,
    category: string | null,
  ): Promise<AiInsightTop100RankContext | null> {
    const id = cardId.trim();
    const cat = category?.trim();
    if (!id || !cat) return null;

    const today = kstToday();
    let row = await this.top100Repo.findOne({
      where: { snapshotDateKst: today, category: cat, grade: 'PSA 10' },
    });
    if (!row?.cardsJson?.length) {
      row = await this.top100Repo.findOne({
        where: { category: cat, grade: 'PSA 10' },
        order: { snapshotDateKst: 'DESC' },
      });
    }
    if (!row?.cardsJson?.length) return null;

    const rank = this.findCardIndex(row.cardsJson, id);
    if (rank == null) return null;

    const priorDate = kstDaysAgo(30);
    const priorRow = await this.top100Repo
      .createQueryBuilder('s')
      .where('s.category = :cat', { cat })
      .andWhere('s.grade = :grade', { grade: 'PSA 10' })
      .andWhere('s.snapshot_date_kst <= :prior', { prior: priorDate })
      .orderBy('s.snapshot_date_kst', 'DESC')
      .getOne();
    let rankChange30d: number | null = null;
    if (priorRow && priorRow.snapshotDateKst <= priorDate) {
      const priorRank = this.findCardIndex(priorRow.cardsJson, id);
      if (priorRank != null) rankChange30d = priorRank - rank;
    }

    return {
      rank: rank + 1,
      category: cat,
      rankChange30d,
    };
  }

  private findCardIndex(cards: Top100Card[], cardId: string): number | null {
    const idx = cards.findIndex(
      (c) => String(c.card_id ?? '').trim() === cardId,
    );
    return idx >= 0 ? idx : null;
  }

  async buildEnrichment(
    col: MarketplaceCollection,
    platform: AiInsightPlatformContext,
    cardId: string | null,
  ): Promise<AiInsightEnrichmentContext> {
    const cert = psaCertNumberFromCollectionRow(col);
    const [watchlistCount, psaCertSnapshot, top100Rank] = await Promise.all([
      this.watchlistCountForCollection(col.collectionKey),
      cert
        ? this.psaCertSnapshots.fetchCertSnapshotJson(cert, {
            allowUpstream: false,
          })
        : Promise.resolve(null),
      cardId
        ? this.top100RankForCard(
            cardId,
            this.resolveTop100Category(col.components ?? {}),
          )
        : Promise.resolve(null),
    ]);

    const gradeScore =
      typeof col.components?.gradeScore === 'string'
        ? col.components.gradeScore.trim()
        : null;

    return {
      platform,
      watchlistCount,
      psaCertSnapshot,
      top100Rank,
      listingGradeScore: gradeScore,
    };
  }

  resolveTop100Category(components: Record<string, unknown>): string | null {
    const psa = components.psaCategory;
    if (typeof psa === 'string' && psa.trim()) {
      const t = psa.trim();
      return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    }
    return null;
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
