import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SelfVaultSettlementStatus =
  | 'pending_confirm'
  | 'confirmed'
  | 'paid'
  | 'rejected';

/**
 * Option A ledger: after a self_vault_hold ask is fulfilled on Seaport,
 * USDC is already at the platform fee wallet. Seller is paid later.
 */
@Entity('self_vault_settlements')
export class SelfVaultSettlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'order_hash', type: 'varchar', length: 80 })
  orderHash: string;

  @Column({ name: 'token_contract', type: 'varchar', length: 42 })
  tokenContract: string;

  @Column({ name: 'token_id', type: 'varchar', length: 64 })
  tokenId: string;

  @Index()
  @Column({ name: 'seller_wallet', type: 'varchar', length: 42 })
  sellerWallet: string;

  @Index()
  @Column({ name: 'buyer_wallet', type: 'varchar', length: 42 })
  buyerWallet: string;

  /** Full Seaport consideration amount (USDC micros as decimal string). */
  @Column({ name: 'gross_usdc', type: 'varchar', length: 78 })
  grossUsdc: string;

  /**
   * Amount owed to seller after platform fee BPS
   * (`gross * (10000 - PLATFORM_FEE_BPS) / 10000`).
   */
  @Column({ name: 'seller_payout_usdc', type: 'varchar', length: 78 })
  sellerPayoutUsdc: string;

  @Column({ name: 'chain_id', type: 'integer' })
  chainId: number;

  @Index()
  @Column({ name: 'status', type: 'varchar', length: 32, default: 'pending_confirm' })
  status: SelfVaultSettlementStatus;

  @Column({ name: 'fulfill_tx_hash', type: 'varchar', length: 80, nullable: true })
  fulfillTxHash: string | null;

  @Column({ name: 'payout_tx_hash', type: 'varchar', length: 80, nullable: true })
  payoutTxHash: string | null;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
