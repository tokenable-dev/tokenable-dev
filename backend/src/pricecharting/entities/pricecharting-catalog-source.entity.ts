import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** One admin-registered CSV URL (Pokemon guide, One Piece guide, or a sports set). */
@Entity('pricecharting_catalog_sources')
@Index('uq_pricecharting_catalog_sources_url', ['url'], { unique: true })
export class PricechartingCatalogSource {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 128 })
  label: string;

  /** Download URL without the API token. The server injects `t` at fetch time. */
  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ name: 'last_status', type: 'varchar', length: 16, nullable: true })
  lastStatus: 'success' | 'error' | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'last_row_count', type: 'integer', nullable: true })
  lastRowCount: number | null;

  @Column({ name: 'last_run_at', type: 'timestamptz', nullable: true })
  lastRunAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
