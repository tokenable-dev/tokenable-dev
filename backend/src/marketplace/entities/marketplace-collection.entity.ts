import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * graded 메타 기준 논리 컬렉션 — 첫 매도(ask) 등록 시 생성된다.
 * collection_key === `computeMarketBucketKey(components)` (풀 입찰 버킷과 동일 경계)
 *
 * Pricing / Cardhedger state: {@link CollectionMarketSnapshot} only.
 * PSA cert facet: `psa_cert_number` column (canonical cert for active listings in bucket).
 */
@Entity('marketplace_collections')
export class MarketplaceCollection {
  @PrimaryColumn({ name: 'collection_key' })
  collectionKey: string;

  @Column({ name: 'display_label' })
  displayLabel: string;

  @Column({ name: 'query_used', type: 'text', nullable: true })
  queryUsed: string | null;

  @Column({ type: 'jsonb' })
  /** Bucket fields + mint enrichments (`cardhedgerCardId`, `psaVariety`, …). */
  components: Record<string, unknown>;

  @Column({ name: 'cover_image_url', type: 'text', nullable: true })
  coverImageUrl: string | null;

  /**
   * Canonical PSA cert from active listing metadata (single value; conflicts skipped).
   * Not duplicated in `components` on new writes.
   */
  @Index()
  @Column({
    name: 'psa_cert_number',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  psaCertNumber: string | null;

  /** Indexed facet from bucket v2 — parallel slug or `base`. */
  @Index()
  @Column({
    name: 'market_parallel_key',
    type: 'varchar',
    length: 96,
    default: 'base',
  })
  marketParallelKey: string;

  /** `BUCKET_KEY_VERSION` used when this row was created / last migrated. */
  @Column({ name: 'bucket_key_version', type: 'smallint', default: 2 })
  bucketKeyVersion: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
