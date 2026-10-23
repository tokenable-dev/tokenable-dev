import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** One admin CSV upload. Re-uploads upsert products; this row is the audit. */
@Entity('pricecharting_import_runs')
export class PricechartingImportRun {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 256 })
  filename: string;

  @Column({ name: 'byte_size', type: 'integer' })
  byteSize: number;

  @Column({ name: 'row_count', type: 'integer', default: 0 })
  rowCount: number;

  @Column({ name: 'skipped_count', type: 'integer', default: 0 })
  skippedCount: number;

  @Column({ type: 'jsonb', default: {} })
  genres: Record<string, number>;

  @Column({ type: 'varchar', length: 16, default: 'success' })
  status: 'success' | 'error';

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
