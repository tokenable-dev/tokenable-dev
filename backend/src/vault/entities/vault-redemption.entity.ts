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

export type VaultRedemptionStatus =
  | 'pending'
  | 'ownership_verified'
  | 'burned'
  | 'vault_release_pending'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Granular audit trail / state machine for a single redemption attempt:
 * verify ownership -> execute on-chain burn -> release physical asset.
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

  @Column({ name: 'ship_to_country', type: 'varchar', length: 8, nullable: true })
  shipToCountry: string | null;

  @Column({ name: 'ship_to_phone', type: 'varchar', length: 40, nullable: true })
  shipToPhone: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
