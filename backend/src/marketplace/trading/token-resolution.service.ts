import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ask } from '../entities/ask.entity';
import type { TokenRuleView } from './token-rule-view';

function flattenExternalRef(raw: Record<string, unknown> | null | undefined): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') {
      out[k] = v;
    } else if (v && typeof v === 'object') {
      for (const [fk, fv] of Object.entries(v as Record<string, unknown>)) {
        if (typeof fv === 'string') {
          out[`${k}:${fk}`] = fv;
        }
      }
    }
  }
  return out;
}

@Injectable()
export class TokenResolutionService {
  constructor(
    @InjectRepository(Ask)
    private readonly askRepo: Repository<Ask>,
  ) {}

  /** Prefer active ask metadata for the token (listing is the execution surface). */
  async buildTokenRuleView(collectionKey: string, tokenId: string): Promise<TokenRuleView | null> {
    const ask = await this.askRepo.findOne({
      where: { collectionKey, tokenId },
      order: { createdAt: 'DESC' },
    });
    if (!ask) return null;
    return this.buildFromAsk(ask);
  }

  buildFromAsk(ask: Ask): TokenRuleView {
    return {
      collectionKey: ask.collectionKey,
      tokenId: ask.tokenId,
      grade: ask.grade,
      traits: ask.traits ?? [],
      externalRef: flattenExternalRef(ask.externalRef ?? undefined),
      snapshotId: ask.snapshotId,
    };
  }
}
