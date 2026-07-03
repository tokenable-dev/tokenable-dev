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

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
