import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * On-chain RWA mint registry — one row per (contract, tokenId).
 * Populated when listings resolve IPFS metadata (and optional boot sync).
 */
@Entity('rwa_tokens')
export class RwaToken {
  @PrimaryColumn({ name: 'token_contract', type: 'varchar', length: 42 })
  tokenContract: string;

  @PrimaryColumn({ name: 'token_id', type: 'varchar', length: 64 })
  tokenId: string;

  @Index()
  @Column({ name: 'cert_number', type: 'varchar', length: 32, nullable: true })
  certNumber: string | null;

  @Column({ name: 'token_uri', type: 'text', nullable: true })
  tokenUri: string | null;

  @Column({ name: 'metadata_cid', type: 'varchar', length: 128, nullable: true })
  metadataCid: string | null;

  @Column({ name: 'display_name', type: 'varchar', length: 512, nullable: true })
  displayName: string | null;

  /** Admin override — shown instead of metadata-derived image when set. */
  @Column({ name: 'display_image_url', type: 'text', nullable: true })
  displayImageUrl: string | null;

  /** Last marketplace bucket from an ask listing (nullable if never listed). */
  @Index()
  @Column({
    name: 'collection_key',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  collectionKey: string | null;

  @Column({ name: 'metadata_synced_at', type: 'timestamptz', nullable: true })
  metadataSyncedAt: Date | null;

  /** Links this mint to its vault_cycles row. NULL for pre-vault-lifecycle tokens. */
  @Column({ name: 'vault_cycle_id', type: 'uuid', nullable: true })
  vaultCycleId: string | null;

  /** On-chain vaultRef this token was minted with (see TokenableRWA.vaultRef()). */
  @Column({ name: 'vault_ref', type: 'varchar', length: 66, nullable: true })
  vaultRef: string | null;

  /** Set once the on-chain adminBurn (redemption) has been confirmed. */
  @Column({ name: 'burned_at', type: 'timestamptz', nullable: true })
  burnedAt: Date | null;

  @Column({ name: 'burn_tx_hash', type: 'varchar', length: 80, nullable: true })
  burnTxHash: string | null;

  /**
   * Seaport settlement policy:
   * - `standard` — seller + platform fee split (default ~5%)
   * - `self_vault_hold` — 100% USDC to platform fee recipient; seller paid later
   */
  @Column({
    name: 'settlement_policy',
    type: 'varchar',
    length: 32,
    default: 'standard',
  })
  settlementPolicy: 'standard' | 'self_vault_hold';

  /**
   * Self-vault partner who holds the physical card.
   * Used for "{displayName} vault" labels after ownership transfers.
   */
  @Index()
  @Column({ name: 'vault_partner_id', type: 'uuid', nullable: true })
  vaultPartnerId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
