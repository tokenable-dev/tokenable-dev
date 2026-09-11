import { Column, Entity, PrimaryColumn } from 'typeorm';

export type CardhedgerDailyExportSource = 'csv_export' | 'price_updates_delta';

export type CardhedgerDailyExportStatus =
  | 'success'
  | 'skipped_enterprise'
  | 'skipped_disabled'
  | 'failed';

@Entity('cardhedger_daily_price_export_runs')
export class CardhedgerDailyPriceExportRun {
  @PrimaryColumn({ name: 'file_date', type: 'date' })
  fileDate: string;

  @Column({ type: 'varchar', length: 32 })
  source: CardhedgerDailyExportSource;

  @Column({ type: 'varchar', length: 32 })
  status: CardhedgerDailyExportStatus;

  @Column({ name: 'row_count', type: 'int', nullable: true })
  rowCount: number | null;

  @Column({ name: 'storage_path', type: 'text', nullable: true })
  storagePath: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'ran_at', type: 'timestamptz', default: () => 'NOW()' })
  ranAt: Date;
}
