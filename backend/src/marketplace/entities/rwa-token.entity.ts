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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
