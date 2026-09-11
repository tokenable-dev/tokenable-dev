import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Tracks Transfer-log backfill progress per RWA contract.
 * When `backfillComplete` is true, `getRwaTokensByOwner` reads from DB only.
 */
@Entity('rwa_owner_index_cursors')
export class RwaOwnerIndexCursor {
  @PrimaryColumn({ name: 'token_contract', type: 'varchar', length: 42 })
  tokenContract!: string;

  @Column({ name: 'last_scanned_block', type: 'bigint', default: '0' })
  lastScannedBlock!: string;

  @Column({ name: 'backfill_complete', type: 'boolean', default: false })
  backfillComplete!: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
