import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type P2pListingStatus =
  | 'P2P_MINTED_TK'
  | 'P2P_LISTED'
  | 'P2P_CANCELLED'
  | 'SOLD'
  | 'BURNED';

@Entity('p2p_listings')
export class P2pListing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'seller_user_id', type: 'uuid' })
  sellerUserId: string;

  @Index()
  @Column({ name: 'cert_number', type: 'varchar', length: 32 })
  certNumber: string;

  @Column({ name: 'vault_ref', type: 'varchar', length: 66 })
  vaultRef: string;

  @Column({ name: 'token_contract', type: 'varchar', length: 42 })
  tokenContract: string;

  @Column({ name: 'token_id', type: 'varchar', length: 64 })
  tokenId: string;

  @Column({ name: 'token_uri', type: 'text', nullable: true })
  tokenUri: string | null;

  @Column({ name: 'mint_tx_hash', type: 'varchar', length: 80, nullable: true })
  mintTxHash: string | null;

  @Column({ name: 'chain_id', type: 'int' })
  chainId: number;

  /** USDC atomic units (6 decimals), listing price. */
  @Column({ name: 'price_usdc', type: 'varchar', length: 78 })
  priceUsdc: string;

  /** Seller payout wallet (linked). */
  @Column({ name: 'seller_wallet', type: 'varchar', length: 42 })
  sellerWallet: string;

  @Column({ name: 'authenticity_accepted_at', type: 'timestamptz' })
  authenticityAcceptedAt: Date;

  @Index()
  @Column({ name: 'status', type: 'varchar', length: 32 })
  status: P2pListingStatus;

  @Column({ name: 'burn_tx_hash', type: 'varchar', length: 80, nullable: true })
  burnTxHash: string | null;

  @Column({ name: 'display_name', type: 'varchar', length: 512, nullable: true })
  displayName: string | null;

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
