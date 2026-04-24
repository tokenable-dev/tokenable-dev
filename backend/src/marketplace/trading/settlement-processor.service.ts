import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Ask } from '../entities/ask.entity';
import { Bid } from '../entities/bid.entity';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { TradeExecution } from '../entities/trade-execution.entity';
import { AskStatus, BidStatus, ExecutionState } from './enums';

const POLL_MS = Number(process.env.SETTLEMENT_POLL_MS ?? 2000);

@Injectable()
export class SettlementProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SettlementProcessorService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(TradeExecution)
    private readonly executionRepo: Repository<TradeExecution>,
  ) {}

  onModuleInit(): void {
    if (process.env.SETTLEMENT_WORKER_ENABLED === 'false') {
      this.logger.warn('Settlement worker disabled (SETTLEMENT_WORKER_ENABLED=false)');
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, POLL_MS);
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    const pending = await this.executionRepo.find({
      where: { executionState: ExecutionState.PENDING },
      order: { createdAt: 'ASC' },
      take: 10,
    });
    for (const ex of pending) {
      try {
        await this.processOne(ex.id);
      } catch (e) {
        this.logger.warn(`Settlement tick failed for ${ex.id}: ${(e as Error).message}`);
      }
    }
  }

  /**
   * Worker-only: pending → locked (CAS), stub chain, executed | failed.
   * API never sets `locked`.
   */
  async processOne(executionId: string): Promise<void> {
    const locked = await this.executionRepo.manager.transaction(async (m) => {
      const res = await m
        .createQueryBuilder()
        .update(TradeExecution)
        .set({ executionState: ExecutionState.LOCKED })
        .where('id = :id AND execution_state = :p', {
          id: executionId,
          p: ExecutionState.PENDING,
        })
        .execute();
      if ((res.affected ?? 0) === 0) {
        return false;
      }
      await m.save(
        OutboxEvent,
        m.create(OutboxEvent, {
          aggregateType: 'trade_execution',
          aggregateId: executionId,
          eventType: 'EXECUTION_LOCKED',
          payload: { executionId },
          published: false,
        }),
      );
      return true;
    });

    if (!locked) {
      return;
    }

    const ex = await this.executionRepo.findOne({ where: { id: executionId } });
    if (!ex) return;

    const failRate = Number(process.env.SETTLEMENT_STUB_FAIL_RATE ?? '0');
    const stubFail =
      process.env.SETTLEMENT_STUB_FAIL === 'true' ||
      (Number.isFinite(failRate) && failRate > 0 && Math.random() < failRate);

    await this.executionRepo.manager.transaction(async (m) => {
      const current = await m.findOne(TradeExecution, { where: { id: executionId } });
      if (!current || current.executionState !== ExecutionState.LOCKED) {
        return;
      }

      if (stubFail) {
        await m.update(Ask, { id: ex.askId }, { status: AskStatus.ACTIVE });
        await m.update(TradeExecution, { id: ex.id }, {
          executionState: ExecutionState.FAILED,
          failureReason: 'SETTLEMENT_STUB_FAILURE',
        });
        await m.save(
          OutboxEvent,
          m.create(OutboxEvent, {
            aggregateType: 'trade_execution',
            aggregateId: ex.id,
            eventType: 'EXECUTION_FAILED',
            payload: { executionId: ex.id, reason: 'SETTLEMENT_STUB_FAILURE' },
            published: false,
          }),
        );
        return;
      }

      const txHash = `0x${randomBytes(16).toString('hex')}`;
      await m.update(Ask, { id: ex.askId }, { status: AskStatus.SOLD });
      await m.update(Bid, { id: ex.bidId }, { status: BidStatus.FILLED });
      await m.update(TradeExecution, { id: ex.id }, {
        executionState: ExecutionState.EXECUTED,
        txHash,
        executedAt: new Date(),
        failureReason: null,
      });
      await m.save(
        OutboxEvent,
        m.create(OutboxEvent, {
          aggregateType: 'trade_execution',
          aggregateId: ex.id,
          eventType: 'EXECUTION_COMPLETED',
          payload: { executionId: ex.id, txHash },
          published: false,
        }),
      );
    });
  }
}
