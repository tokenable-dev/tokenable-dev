import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export enum PortfolioCostBasisSource {
  MANUAL = 'manual',
  VAULT_DELIVERY = 'vault_delivery',
  MARKETPLACE_BUY = 'marketplace_buy',
}

/** Per-wallet hide + cost basis — off-chain prefs; does not transfer or burn the NFT. */
@Entity('portfolio_holdings')
@Unique('portfolio_holdings_wallet_contract_token_unique', [
  'walletAddress',
  'tokenContract',
  'tokenId',
])
export class PortfolioHolding {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'wallet_address', type: 'varchar', length: 42 })
  walletAddress: string;

  @Column({ name: 'token_contract', type: 'varchar', length: 42 })
  tokenContract: string;

  @Column({ name: 'token_id', type: 'int' })
  tokenId: number;

  @Column({ name: 'hidden_at', type: 'timestamptz', nullable: true })
  hiddenAt: Date | null;

  @Column({
    name: 'cost_basis_usd',
    type: 'double precision',
    nullable: true,
  })
  costBasisUsd: number | null;

  @Column({
    name: 'cost_basis_source',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  costBasisSource: PortfolioCostBasisSource | null;

  @Column({ name: 'acquired_at', type: 'timestamptz', nullable: true })
  acquiredAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
