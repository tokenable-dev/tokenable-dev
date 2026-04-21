import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bid } from '../entities/bid.entity';
import { BidStatus } from './enums';
import { RuleEngineService } from './rule-engine.service';
import { TokenResolutionService } from './token-resolution.service';

export type BidListItemView = {
  id: string;
  bidderAddress: string;
  collectionKey: string;
  tokenId: string | null;
  priceMicros: string;
  currency: string;
  status: BidStatus;
  snapshotId: string | null;
  expiresAt: Date;
  applicability?: { ok: boolean; reason: string };
};

@Injectable()
export class BidsQueryService {
  constructor(
    @InjectRepository(Bid)
    private readonly bidRepo: Repository<Bid>,
    private readonly ruleEngine: RuleEngineService,
    private readonly tokenResolution: TokenResolutionService,
  ) {}

  async listBids(collectionKey: string, tokenId?: string): Promise<BidListItemView[]> {
    const qb = this.bidRepo
      .createQueryBuilder('b')
      .where('b.collection_key = :ck', { ck: collectionKey })
      .andWhere('b.status = :st', { st: BidStatus.ACTIVE })
      .orderBy('b.price_micros', 'DESC');

    const bids = await qb.getMany();

    let tokenView = null as Awaited<
      ReturnType<TokenResolutionService['buildTokenRuleView']>
    > | null;
    if (tokenId) {
      tokenView = await this.tokenResolution.buildTokenRuleView(collectionKey, tokenId);
    }

    return bids.map((row) => {
      const base: BidListItemView = {
        id: row.id,
        bidderAddress: row.bidderAddress,
        collectionKey: row.collectionKey,
        tokenId: row.tokenId,
        priceMicros: row.priceMicros,
        currency: row.currency,
        status: row.status,
        snapshotId: row.snapshotId,
        expiresAt: row.expiresAt,
      };
      if (tokenId) {
        if (!tokenView) {
          base.applicability = { ok: false, reason: 'TOKEN_VIEW_UNAVAILABLE' };
        } else {
          const r = this.ruleEngine.isBidApplicable(
            {
              collectionKey: row.collectionKey,
              expiresAt: row.expiresAt,
              snapshotId: row.snapshotId,
              tokenId: row.tokenId,
            },
            row.rule,
            tokenView,
          );
          base.applicability = { ok: r.ok, reason: r.reason };
        }
      }
      return base;
    });
  }

  async getBid(id: string): Promise<Bid | null> {
    return this.bidRepo.findOne({ where: { id } });
  }
}
