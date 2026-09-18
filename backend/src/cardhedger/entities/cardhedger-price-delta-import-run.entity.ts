import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type CardhedgerDeltaImportMatchedCollection = {
  collectionKey: string;
  cardId: string;
  grade: string | null;
  price: string | null;
  cardDesc: string | null;
  updateTimestamp: string | null;
};

export type CardhedgerDeltaImportSampleUpdate = {
  cardId: string;
  grade: string | null;
  price: string | null;
  cardDesc: string | null;
  player: string | null;
  updateTimestamp: string | null;
  matchedCollectionKeys: string[];
};

@Entity('cardhedger_price_delta_import_runs')
export class CardhedgerPriceDeltaImportRun {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'ran_at', type: 'timestamptz', default: () => 'NOW()' })
  ranAt: Date;

  @Column({ name: 'since_iso', type: 'varchar', length: 40 })
  sinceIso: string;

  @Column({ name: 'latest_timestamp_iso', type: 'varchar', length: 40, nullable: true })
  latestTimestampIso: string | null;

  @Column({ name: 'update_count', type: 'int', default: 0 })
  updateCount: number;

  @Column({ name: 'unique_card_ids', type: 'int', default: 0 })
  uniqueCardIds: number;

  @Column({ name: 'matched_collection_count', type: 'int', default: 0 })
  matchedCollectionCount: number;

  @Column({ name: 'delta_matched_collection_count', type: 'int', default: 0 })
  deltaMatchedCollectionCount: number;

  @Column({ name: 'catalog_fallback_count', type: 'int', default: 0 })
  catalogFallbackCount: number;

  @Column({ name: 'unmatched_update_count', type: 'int', default: 0 })
  unmatchedUpdateCount: number;

  @Column({ name: 'enqueued_collection_keys', type: 'jsonb', default: () => "'[]'" })
  enqueuedCollectionKeys: string[];

  @Column({ name: 'matched_collections', type: 'jsonb', default: () => "'[]'" })
  matchedCollections: CardhedgerDeltaImportMatchedCollection[];

  @Column({ name: 'sample_updates', type: 'jsonb', default: () => "'[]'" })
  sampleUpdates: CardhedgerDeltaImportSampleUpdate[];

  @Column({ type: 'varchar', length: 32, default: 'success' })
  status: 'success' | 'failed';

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;
}
