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
import { VaultCycle } from './vault-cycle.entity';

/**
 * Redeem lifecycle:
 * - ownership_verified: USDC paid, awaiting user-signed NFT → custody
 * - in_custody: NFT held at RWA_CUSTODY (Preparing UI)
 * - burned / vault_release_pending / completed: physical ops
 * - refunded: USDC (+ usually NFT) returned
 */
export type VaultRedemptionStatus =
  | 'pending'
  | 'ownership_verified'
  | 'in_custody'
  | 'burned'
  | 'vault_release_pending'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'refunded';

export type VaultRedemptionRefundStatus =
  | 'none'
  | 'usdc_refunded'
  | 'nft_returned'
  | 'fully_refunded';

/**
 * Granular audit trail / state machine for a single redemption attempt:
 * pay → user custody transfer → burn → release (or refund before tracking).
 */
@Entity('vault_redemptions')
export class VaultRedemption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'vault_cycle_id', type: 'uuid' })
  vaultCycleId: string;

  @ManyToOne(() => VaultCycle, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vault_cycle_id' })
  vaultCycle: VaultCycle;

  @Column({ name: 'requested_by_user_id', type: 'uuid', nullable: true })
  requestedByUserId: string | null;

  @CreateDateColumn({ name: 'requested_at', type: 'timestamptz' })
  requestedAt: Date;

  @Column({ name: 'owner_wallet_address', type: 'varchar', length: 42 })
  ownerWalletAddress: string;

  @Column({ type: 'varchar', length: 24, default: 'pending' })
  status: VaultRedemptionStatus;

  @Column({ name: 'ownership_verified_at', type: 'timestamptz', nullable: true })
  ownershipVerifiedAt: Date | null;

  @Column({ name: 'burn_tx_hash', type: 'varchar', length: 80, nullable: true })
  burnTxHash: string | null;

  @Column({ name: 'burned_at', type: 'timestamptz', nullable: true })
  burnedAt: Date | null;

  @Column({ name: 'vault_released_at', type: 'timestamptz', nullable: true })
  vaultReleasedAt: Date | null;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ name: 'ship_to_name', type: 'varchar', length: 128, nullable: true })
  shipToName: string | null;

  @Column({ name: 'ship_to_line1', type: 'varchar', length: 256, nullable: true })
  shipToLine1: string | null;

  @Column({ name: 'ship_to_line2', type: 'varchar', length: 256, nullable: true })
  shipToLine2: string | null;

  @Column({ name: 'ship_to_city', type: 'varchar', length: 128, nullable: true })
  shipToCity: string | null;

  @Column({ name: 'ship_to_region', type: 'varchar', length: 128, nullable: true })
  shipToRegion: string | null;

  @Column({ name: 'ship_to_postal', type: 'varchar', length: 32, nullable: true })
  shipToPostal: string | null;

  /** ISO-3166 alpha-2 at redeem time (not fee bucket us|ca|intl). */
  @Column({ name: 'ship_to_country', type: 'varchar', length: 8, nullable: true })
  shipToCountry: string | null;

  @Column({ name: 'ship_to_phone', type: 'varchar', length: 40, nullable: true })
  shipToPhone: string | null;

  @Column({
    name: 'fee_retrieval_usd',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  feeRetrievalUsd: string | null;

  @Column({
    name: 'fee_early_withdrawal_usd',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  feeEarlyWithdrawalUsd: string | null;

  @Column({
    name: 'fee_shipping_usd',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  feeShippingUsd: string | null;

  @Column({
    name: 'fee_total_usd',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  feeTotalUsd: string | null;

  @Column({ name: 'payment_tx_hash', type: 'varchar', length: 80, nullable: true })
  paymentTxHash: string | null;

  @Index()
  @Column({ name: 'payment_batch_id', type: 'uuid', nullable: true })
  paymentBatchId: string | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  /** EIP-155 chain of the NFT / payment (v1: Sepolia 11155111). */
  @Column({ name: 'chain_id', type: 'integer', nullable: true })
  chainId: number | null;

  /**
   * Exact USDC micros that arrived for this payment_batch (duplicated per sibling row).
   * Batch-total grain — never SUM across rows. Prefer vault_redeem_payment_claims for uniqueness.
   */
  @Column({
    name: 'payment_received_usdc_micros',
    type: 'numeric',
    precision: 24,
    scale: 0,
    nullable: true,
  })
  paymentReceivedUsdcMicros: string | null;

  @Column({ name: 'custody_tx_hash', type: 'varchar', length: 80, nullable: true })
  custodyTxHash: string | null;

  @Column({ name: 'custody_at', type: 'timestamptz', nullable: true })
  custodyAt: Date | null;

  @Column({
    name: 'custody_return_tx_hash',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  custodyReturnTxHash: string | null;

  @Column({ name: 'custody_returned_at', type: 'timestamptz', nullable: true })
  custodyReturnedAt: Date | null;

  @Column({
    name: 'refund_status',
    type: 'varchar',
    length: 24,
    default: 'none',
  })
  refundStatus: VaultRedemptionRefundStatus;

  @Column({ name: 'refund_tx_hash', type: 'varchar', length: 80, nullable: true })
  refundTxHash: string | null;

  @Column({
    name: 'refunded_usdc_micros',
    type: 'numeric',
    precision: 24,
    scale: 0,
    nullable: true,
  })
  refundedUsdcMicros: string | null;

  @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
  refundedAt: Date | null;

  @Column({ name: 'tracking_number', type: 'varchar', length: 128, nullable: true })
  trackingNumber: string | null;

  @Column({ name: 'tracking_carrier', type: 'varchar', length: 64, nullable: true })
  trackingCarrier: string | null;

  @Column({ name: 'tracking_set_at', type: 'timestamptz', nullable: true })
  trackingSetAt: Date | null;

  /**
   * Carrier Track API reported Delivered (FedEx ACTUAL_DELIVERY / DL).
   * Starts the auto-receipt grace window (`REDEEM_AUTO_RECEIPT_GRACE_DAYS`).
   */
  @Column({ name: 'carrier_delivered_at', type: 'timestamptz', nullable: true })
  carrierDeliveredAt: Date | null;

  /** `user` = confirm-received tap; `auto` = grace cron after carrier delivery. */
  @Column({ name: 'receipt_confirmed_via', type: 'varchar', length: 16, nullable: true })
  receiptConfirmedVia: 'user' | 'auto' | null;

  @Column({ name: 'admin_memo', type: 'text', nullable: true })
  adminMemo: string | null;

  @Column({ name: 'vaulted_at', type: 'timestamptz', nullable: true })
  vaultedAt: Date | null;

  @Column({ name: 'early_withdrawal', type: 'boolean', nullable: true })
  earlyWithdrawal: boolean | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
