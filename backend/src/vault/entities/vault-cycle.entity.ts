import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { VaultAsset } from './vault-asset.entity';

export type VaultCycleStatus =
  | 'pending_deposit'
  | 'deposit_verified'
  | 'minted'
  | 'redemption_requested'
  | 'redeemed'
  | 'cancelled';

/**
 * One deposit-to-redemption lifecycle for a `VaultAsset`.
 *
 * At most one non-terminal cycle (status not in redeemed/cancelled) may exist
 * per asset at a time — enforced by a DB partial unique index, mirroring the
 * on-chain `activeTokenIdByVaultRef` invariant in `TokenableRWA`.
 */
@Entity('vault_cycles')
@Unique('vault_cycles_asset_number_unique', ['vaultAssetId', 'cycleNumber'])
export class VaultCycle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'vault_asset_id', type: 'uuid' })
  vaultAssetId: string;

  @ManyToOne(() => VaultAsset, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vault_asset_id' })
  vaultAsset: VaultAsset;

  @Column({ name: 'cycle_number', type: 'int' })
  cycleNumber: number;

  @Column({ type: 'varchar', length: 24, default: 'pending_deposit' })
  status: VaultCycleStatus;

  @Column({ name: 'deposited_at', type: 'timestamptz', nullable: true })
  depositedAt: Date | null;

  /** Admin/ops user who manually verified the deposit; NULL when auto-verified. */
  @Column({ name: 'deposit_verified_by', type: 'uuid', nullable: true })
  depositVerifiedBy: string | null;

  @Column({ name: 'deposited_by_user_id', type: 'uuid', nullable: true })
  depositedByUserId: string | null;

  @Column({ name: 'redeemed_at', type: 'timestamptz', nullable: true })
  redeemedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
