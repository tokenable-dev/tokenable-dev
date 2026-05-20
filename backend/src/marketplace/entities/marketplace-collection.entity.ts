import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * graded 메타 기준 논리 컬렉션 — 첫 매도(ask) 등록 시 생성된다.
 * collection_key === `computeMarketBucketKey(components)` (풀 입찰 버킷과 동일 경계)
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
  /** Bucket fields + optional enrichments (`listingDisplayTitle` = IPFS `metadata.name` at listing). */
  components: Record<string, unknown>;

  /**
   * 컬렉션 고정 커버 — 카탈로그 카드 아트/PSA 이미지 URL (슬랩 촬영본과는 별도).
   * 첫 매도 등록 시 또는 나중에 resolve 시 한 번 채움.
   */
  @Column({ name: 'cover_image_url', type: 'text', nullable: true })
  coverImageUrl: string | null;

  /** Last resolved Cardhedger card id from market bundle (audit / support). */
  @Column({
    name: 'cardhedger_resolved_card_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  cardhedgerResolvedCardId: string | null;

  /** Published PSA10 headline USD at last bundle resolution. */
  @Column({
    name: 'cardhedger_headline_usd',
    type: 'double precision',
    nullable: true,
  })
  cardhedgerHeadlineUsd: number | null;

  /** e.g. comps, latest_sale, sparse_sale_avg, catalog — mirrors API `spotPriceBasis`. */
  @Column({
    name: 'cardhedger_spot_basis',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  cardhedgerSpotBasis: string | null;

  @Column({
    name: 'cardhedger_pricing_synced_at',
    type: 'timestamptz',
    nullable: true,
  })
  cardhedgerPricingSyncedAt: Date | null;

  /**
   * Canonical PSA cert digits from active listing metadata (single value; conflicting asks skipped).
   * Mirrors `components.psaCertNumber` when backfilled.
   */
  @Column({
    name: 'psa_cert_number',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  psaCertNumber: string | null;

  /**
   * Compact PSA Public API cert fields — reduces repeat upstream calls; refreshed on a TTL.
   */
  @Column({ name: 'psa_public_snapshot_json', type: 'jsonb', nullable: true })
  psaPublicSnapshotJson: Record<string, unknown> | null;

  @Column({
    name: 'psa_public_snapshot_at',
    type: 'timestamptz',
    nullable: true,
  })
  psaPublicSnapshotAt: Date | null;

  /**
   * Cardhedger resolve + preview + chart tail for `GET …/market-series` (see `MarketBundleCacheV1`).
   */
  @Column({ name: 'market_bundle_cache_json', type: 'jsonb', nullable: true })
  marketBundleCacheJson: Record<string, unknown> | null;

  @Column({
    name: 'market_bundle_cached_at',
    type: 'timestamptz',
    nullable: true,
  })
  marketBundleCachedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
