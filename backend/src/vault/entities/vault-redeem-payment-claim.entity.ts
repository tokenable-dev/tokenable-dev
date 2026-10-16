import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/**
 * Ledger for redeem USDC payment tx hashes.
 *
 * A multi-card batch stores the same `payment_tx_hash` on every
 * `vault_redemptions` row, so uniqueness cannot live on that column alone.
 * This table is the DB source of truth that a payment tx may only fund one batch.
 */
@Entity('vault_redeem_payment_claims')
export class VaultRedeemPaymentClaim {
  @PrimaryColumn({ name: 'payment_tx_hash', type: 'varchar', length: 80 })
  paymentTxHash: string;

  @Index({ unique: true })
  @Column({ name: 'payment_batch_id', type: 'uuid' })
  paymentBatchId: string;

  @Column({
    name: 'payment_received_usdc_micros',
    type: 'numeric',
    precision: 24,
    scale: 0,
    nullable: true,
  })
  paymentReceivedUsdcMicros: string | null;

  @Column({ name: 'chain_id', type: 'integer', nullable: true })
  chainId: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
