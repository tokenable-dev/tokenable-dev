import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/** One row per wallet per KST calendar day (09:00 Asia/Seoul capture). */
@Entity('portfolio_daily_snapshots')
@Unique('portfolio_daily_snapshots_wallet_date_unique', [
  'walletAddress',
  'snapshotDateKst',
])
export class PortfolioDailySnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'wallet_address', type: 'varchar', length: 42 })
  walletAddress: string;

  @Column({ name: 'snapshot_date_kst', type: 'date' })
  snapshotDateKst: string;

  @Column({ name: 'snapshot_at', type: 'timestamptz' })
  snapshotAt: Date;

  @Column({ name: 'total_value_usd', type: 'double precision' })
  totalValueUsd: number;

  @Column({ name: 'card_count', type: 'int', default: 0 })
  cardCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
