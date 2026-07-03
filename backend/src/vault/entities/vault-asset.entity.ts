import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export type VaultAssetType = 'psa_graded';

/**
 * Permanent identity of a physical asset (e.g. a PSA-graded card).
 *
 * Survives across multiple vault deposit/redeem cycles — a physical card may
 * legitimately have several historical NFTs over its lifetime, but only one
 * `VaultAsset` row exists per physical card forever.
 */
@Entity('vault_assets')
@Unique('vault_assets_type_cert_unique', ['assetType', 'externalCertNumber'])
export class VaultAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'asset_type', type: 'varchar', length: 32, default: 'psa_graded' })
  assetType: VaultAssetType;

  @Column({ name: 'external_cert_number', type: 'varchar', length: 32 })
  externalCertNumber: string;

  /** keccak256(normalized cert number) — must match TokenableRWA.vaultRef() on-chain. */
  @Column({ name: 'vault_ref', type: 'varchar', length: 66, unique: true })
  vaultRef: string;

  @Column({ name: 'display_name', type: 'varchar', length: 512, nullable: true })
  displayName: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
