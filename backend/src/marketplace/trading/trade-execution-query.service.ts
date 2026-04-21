import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradeExecution } from '../entities/trade-execution.entity';

export type TradeExecutionView = {
  id: string;
  matchIntentId: string;
  askId: string;
  bidId: string;
  executionState: string;
  txHash: string | null;
  failureReason: string | null;
  createdAt: Date;
  executedAt: Date | null;
};

@Injectable()
export class TradeExecutionQueryService {
  constructor(
    @InjectRepository(TradeExecution)
    private readonly executionRepo: Repository<TradeExecution>,
  ) {}

  async getByIdOrThrow(id: string): Promise<TradeExecutionView> {
    const row = await this.executionRepo.findOne({
      where: { id },
      relations: { matchIntent: false },
    });
    if (!row) {
      throw new NotFoundException(`Execution not found: ${id}`);
    }
    return {
      id: row.id,
      matchIntentId: row.matchIntentId,
      askId: row.askId,
      bidId: row.bidId,
      executionState: row.executionState,
      txHash: row.txHash,
      failureReason: row.failureReason,
      createdAt: row.createdAt,
      executedAt: row.executedAt,
    };
  }
}
