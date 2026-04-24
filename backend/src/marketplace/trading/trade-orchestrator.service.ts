import { createHash } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import type { MatchAcceptedResponseDto } from '../dto/match-accepted.response';
import type { TradeMatchDto } from '../dto/trade-match.dto';
import { Ask } from '../entities/ask.entity';
import { Bid } from '../entities/bid.entity';
import { IdempotencyKey } from '../entities/idempotency-key.entity';
import { MatchIntent } from '../entities/match-intent.entity';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { TradeExecution } from '../entities/trade-execution.entity';
import {
  AskStatus,
  BidStatus,
  ExecutionState,
  MatchState,
} from './enums';
import { RuleEngineService } from './rule-engine.service';
import { TokenResolutionService } from './token-resolution.service';

function isPgUniqueViolation(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const code = (err as QueryFailedError & { driverError?: { code?: string } }).driverError?.code;
  return code === '23505';
}

function microsGte(a: string, b: string): boolean {
  try {
    return BigInt(a) >= BigInt(b);
  } catch {
    return false;
  }
}

@Injectable()
export class TradeOrchestratorService {
  constructor(
    @InjectDataSource()
    private readonly ds: DataSource,
    private readonly ruleEngine: RuleEngineService,
    private readonly tokenResolution: TokenResolutionService,
  ) {}

  resolveIdempotencyKey(headerVal: string | undefined, dto: TradeMatchDto): string {
    const trimmed = headerVal?.trim();
    if (trimmed && trimmed.length > 0) {
      return trimmed.slice(0, 256);
    }
    return createHash('sha256').update(`${dto.bidId}:${dto.askId}:${dto.tokenId}`).digest('hex');
  }

  async match(
    dto: TradeMatchDto,
    idempotencyKeyHeader?: string,
  ): Promise<MatchAcceptedResponseDto> {
    const idempotencyKey = this.resolveIdempotencyKey(idempotencyKeyHeader, dto);
    try {
      return await this.ds.transaction(async (manager) => {
        await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1::text))`, [idempotencyKey]);

        const existingKey = await manager.findOne(IdempotencyKey, {
          where: { key: idempotencyKey },
        });
        if (existingKey) {
          const ex = await manager.findOne(TradeExecution, {
            where: { id: existingKey.executionId },
          });
          if (!ex) {
            throw new ConflictException('Idempotency record references missing execution');
          }
          return this.toAccepted(ex.id, ex.matchIntentId);
        }

        const ask = await manager
          .getRepository(Ask)
          .createQueryBuilder('a')
          .setLock('pessimistic_write')
          .where('a.id = :id', { id: dto.askId })
          .getOne();
        if (!ask) {
          throw new NotFoundException(`Ask not found: ${dto.askId}`);
        }

        const bid = await manager
          .getRepository(Bid)
          .createQueryBuilder('b')
          .setLock('pessimistic_write')
          .where('b.id = :id', { id: dto.bidId })
          .getOne();
        if (!bid) {
          throw new NotFoundException(`Bid not found: ${dto.bidId}`);
        }

        if (ask.status !== AskStatus.ACTIVE) {
          throw new BadRequestException({ code: 'ASK_NOT_ACTIVE', status: ask.status });
        }
        if (bid.status !== BidStatus.ACTIVE) {
          throw new BadRequestException({ code: 'BID_NOT_ACTIVE', status: bid.status });
        }
        if (ask.tokenId !== dto.tokenId) {
          throw new BadRequestException({ code: 'TOKEN_ID_NOT_ON_ASK', askTokenId: ask.tokenId });
        }
        if (ask.collectionKey !== bid.collectionKey) {
          throw new BadRequestException({ code: 'COLLECTION_MISMATCH' });
        }
        if (!microsGte(bid.priceMicros, ask.priceMicros)) {
          throw new BadRequestException({ code: 'BID_PRICE_TOO_LOW' });
        }

        const tokenView = this.tokenResolution.buildFromAsk(ask);
        const ruleRes = this.ruleEngine.isBidApplicable(
          {
            collectionKey: bid.collectionKey,
            expiresAt: bid.expiresAt,
            snapshotId: bid.snapshotId,
            tokenId: bid.tokenId,
          },
          bid.rule,
          tokenView,
        );
        if (!ruleRes.ok) {
          throw new BadRequestException({ code: 'RULE_NOT_APPLICABLE', reason: ruleRes.reason });
        }

        const intent = manager.create(MatchIntent, {
          bidId: bid.id,
          askId: ask.id,
          tokenId: dto.tokenId,
          matchState: MatchState.MATCHED,
          ruleResult: { ...ruleRes },
        });
        await manager.save(intent);

        const execution = manager.create(TradeExecution, {
          matchIntentId: intent.id,
          askId: ask.id,
          bidId: bid.id,
          executionState: ExecutionState.PENDING,
        });
        await manager.save(execution);

        await manager.update(Ask, { id: ask.id }, { status: AskStatus.LOCKED });

        await manager.save(
          manager.create(OutboxEvent, {
            aggregateType: 'match_intent',
            aggregateId: intent.id,
            eventType: 'MATCH_CREATED',
            payload: {
              matchIntentId: intent.id,
              bidId: bid.id,
              askId: ask.id,
              tokenId: dto.tokenId,
            },
            published: false,
          }),
        );
        await manager.save(
          manager.create(OutboxEvent, {
            aggregateType: 'trade_execution',
            aggregateId: execution.id,
            eventType: 'EXECUTION_PENDING',
            payload: {
              executionId: execution.id,
              matchIntentId: intent.id,
            },
            published: false,
          }),
        );

        await manager.save(
          IdempotencyKey,
          manager.create(IdempotencyKey, {
            key: idempotencyKey,
            executionId: execution.id,
          }),
        );

        return this.toAccepted(execution.id, intent.id);
      });
    } catch (e) {
      if (isPgUniqueViolation(e)) {
        throw new ConflictException({
          code: 'CONCURRENT_OR_DUPLICATE',
          message: 'Match reservation conflict (ask/bid in-flight or duplicate intent)',
        });
      }
      throw e;
    }
  }

  private toAccepted(executionId: string, matchIntentId: string): MatchAcceptedResponseDto {
    return {
      executionId,
      matchIntentId,
      executionState: 'pending',
      pollUrl: `/api/marketplace/trade/executions/${executionId}`,
    };
  }
}
