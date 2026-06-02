import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/** Per-wallet hide — off-chain preference only; does not transfer or burn the NFT. */
@Entity('portfolio_hidden_holdings')
@Unique('portfolio_hidden_holdings_wallet_token_unique', [
  'walletAddress',
  'tokenId',
])
export class PortfolioHiddenHolding {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'wallet_address', type: 'varchar', length: 42 })
  walletAddress: string;

  @Column({ name: 'token_id', type: 'int' })
  tokenId: number;

  @CreateDateColumn({ name: 'hidden_at', type: 'timestamptz' })
  hiddenAt: Date;
}
