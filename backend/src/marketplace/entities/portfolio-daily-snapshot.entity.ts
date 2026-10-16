import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/** One row per wallet per RWA contract per KST calendar day (09:00 Asia/Seoul cron). */
@Entity('portfolio_daily_snapshots')
@Unique('portfolio_daily_snapshots_wallet_date_chain_contract_unique', [
  'walletAddress',
  'snapshotDateKst',
  'chainId',
  'tokenContract',
])
@Index('idx_portfolio_daily_snapshots_wallet_chain_at', [
  'walletAddress',
  'chainId',
  'snapshotAt',
])
@Index('idx_portfolio_daily_snapshots_chain', ['chainId'])
export class PortfolioDailySnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'wallet_address', type: 'varchar', length: 42 })
  walletAddress: string;

  @Column({ name: 'snapshot_date_kst', type: 'date' })
  snapshotDateKst: string;

  /** EIP-155 chain id for the RWA contract whose holdings were marked. */
  @Column({ name: 'chain_id', type: 'int' })
  chainId: number;

  /** RWA address marked in this row. Unstamped rows are a previous contract and are not read. */
  @Index()
  @Column({ name: 'token_contract', type: 'varchar', length: 42, nullable: true })
  tokenContract: string | null;

  @Column({ name: 'snapshot_at', type: 'timestamptz' })
  snapshotAt: Date;

  @Column({ name: 'total_value_usd', type: 'double precision' })
  totalValueUsd: number;

  @Column({ name: 'card_count', type: 'int', default: 0 })
  cardCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
