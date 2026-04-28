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
  components: Record<string, unknown>;

  /**
   * 컬렉션 고정 커버 — 카탈로그 카드 아트/PSA 이미지 URL (슬랩 촬영본과는 별도).
   * 첫 매도 등록 시 또는 나중에 resolve 시 한 번 채움.
   */
  @Column({ name: 'cover_image_url', type: 'text', nullable: true })
  coverImageUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
