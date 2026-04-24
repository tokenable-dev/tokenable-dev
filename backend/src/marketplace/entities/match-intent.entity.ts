import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MatchState } from '../trading/enums';
import { Ask } from './ask.entity';
import { Bid } from './bid.entity';

@Entity('match_intents')
export class MatchIntent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bid_id', type: 'uuid' })
  bidId: string;

  @ManyToOne(() => Bid, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'bid_id' })
  bid: Bid;

  @Column({ name: 'ask_id', type: 'uuid' })
  askId: string;

  @ManyToOne(() => Ask, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ask_id' })
  ask: Ask;

  @Column({ name: 'token_id', type: 'varchar', length: 128 })
  tokenId: string;

  @Column({
    name: 'match_state',
    type: 'varchar',
    length: 32,
    default: MatchState.MATCHED,
  })
  matchState: MatchState;

  @Column({ name: 'rule_result', type: 'jsonb', nullable: true })
  ruleResult: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
