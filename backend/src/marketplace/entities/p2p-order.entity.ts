import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type P2pOrderStatus =
  | 'SOLD'
  | 'SETTLED'
  | 'CLOSED'
  | 'REFUNDED'
  | 'BURNED';

@Entity('p2p_orders')
export class P2pOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'listing_id', type: 'uuid' })
  listingId: string;

  @Index()
  @Column({ name: 'buyer_user_id', type: 'uuid' })
  buyerUserId: string;

  @Column({ name: 'buyer_wallet', type: 'varchar', length: 42 })
  buyerWallet: string;

  @Column({ name: 'seller_user_id', type: 'uuid' })
  sellerUserId: string;

  @Column({ name: 'seller_wallet', type: 'varchar', length: 42 })
  sellerWallet: string;

  @Column({ name: 'token_contract', type: 'varchar', length: 42 })
  tokenContract: string;

  @Column({ name: 'token_id', type: 'varchar', length: 64 })
  tokenId: string;

  @Column({ name: 'price_usdc', type: 'varchar', length: 78 })
  priceUsdc: string;

  @Column({ name: 'chain_id', type: 'int' })
  chainId: number;

  /** bytes32 hex for on-chain escrow mapping. */
  @Index({ unique: true })
  @Column({ name: 'escrow_order_id', type: 'varchar', length: 66 })
  escrowOrderId: string;

  @Column({ name: 'escrow_address', type: 'varchar', length: 42, nullable: true })
  escrowAddress: string | null;

  @Column({ name: 'deposit_tx_hash', type: 'varchar', length: 80, nullable: true })
  depositTxHash: string | null;

  @Column({ name: 'release_tx_hash', type: 'varchar', length: 80, nullable: true })
  releaseTxHash: string | null;

  @Column({ name: 'refund_tx_hash', type: 'varchar', length: 80, nullable: true })
  refundTxHash: string | null;

  @Column({ name: 'auto_release_at', type: 'timestamptz' })
  autoReleaseAt: Date;

  /** Ship-by deadline for no-ship refund (5 business days from sold). */
  @Column({ name: 'ship_by_at', type: 'timestamptz' })
  shipByAt: Date;

  @Column({ name: 'tracking_number', type: 'varchar', length: 128, nullable: true })
  trackingNumber: string | null;

  @Column({ name: 'carrier', type: 'varchar', length: 32, nullable: true })
  carrier: string | null;

  @Column({ name: 'ship_to_name', type: 'varchar', length: 256, nullable: true })
  shipToName: string | null;

  @Column({ name: 'ship_to_line1', type: 'varchar', length: 512, nullable: true })
  shipToLine1: string | null;

  @Column({ name: 'ship_to_line2', type: 'varchar', length: 512, nullable: true })
  shipToLine2: string | null;

  @Column({ name: 'ship_to_city', type: 'varchar', length: 128, nullable: true })
  shipToCity: string | null;

  @Column({ name: 'ship_to_region', type: 'varchar', length: 128, nullable: true })
  shipToRegion: string | null;

  @Column({ name: 'ship_to_postal', type: 'varchar', length: 32, nullable: true })
  shipToPostal: string | null;

  @Column({ name: 'ship_to_country', type: 'varchar', length: 8, nullable: true })
  shipToCountry: string | null;

  @Index()
  @Column({ name: 'status', type: 'varchar', length: 32 })
  status: P2pOrderStatus;

  @Column({ name: 'burn_tx_hash', type: 'varchar', length: 80, nullable: true })
  burnTxHash: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
