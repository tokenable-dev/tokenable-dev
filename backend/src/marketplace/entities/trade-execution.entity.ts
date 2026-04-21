import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ExecutionState } from '../trading/enums';
import { MatchIntent } from './match-intent.entity';

@Entity('trade_executions')
@Index('uq_trade_executions_ask_inflight', ['askId'], {
  unique: true,
  where: `"execution_state" IN ('pending', 'locked')`,
})
@Index('uq_trade_executions_bid_inflight', ['bidId'], {
  unique: true,
  where: `"execution_state" IN ('pending', 'locked')`,
})
@Index('uq_trade_executions_match_intent', ['matchIntentId'], { unique: true })
export class TradeExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'match_intent_id', type: 'uuid' })
  matchIntentId: string;

  @ManyToOne(() => MatchIntent, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'match_intent_id' })
  matchIntent: MatchIntent;

  /** Denormalized for partial unique (in-flight reservation per ask) */
  @Column({ name: 'ask_id', type: 'uuid' })
  askId: string;

  /** Denormalized for partial unique (in-flight reservation per bid) */
  @Column({ name: 'bid_id', type: 'uuid' })
  bidId: string;

  @Column({
    name: 'execution_state',
    type: 'varchar',
    length: 32,
    default: ExecutionState.PENDING,
  })
  executionState: ExecutionState;

  @Column({ name: 'tx_hash', type: 'varchar', length: 128, nullable: true })
  txHash: string | null;

  @Column({ name: 'failure_reason', type: 'varchar', length: 512, nullable: true })
  failureReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'executed_at', type: 'timestamptz', nullable: true })
  executedAt: Date | null;
}
