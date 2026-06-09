import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export type Top100Card = {
  card_id: string;
  description: string;
  player: string | null;
  set: string | null;
  number: string | null;
  variant: string | null;
  image: string | null;
  category: string | null;
  category_group: string | null;
  set_type: string | null;
  '90_day_sales': number | null;
  grade: string | null;
  price: string | null;
};

/**
 * One row per (snapshot_date_kst, category, grade).
 *
 * History accumulates daily — rows are never overwritten.
 * Serving logic always reads the row where snapshot_date_kst = today (KST).
 * If today's row is missing (e.g. server restarted before cron), the service
 * fetches live and inserts a new row.
 */
@Entity('card_top100_daily_snapshots')
@Unique('card_top100_daily_snapshots_date_category_grade_uq', [
  'snapshotDateKst',
  'category',
  'grade',
])
export class CardTop100DailySnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  /** KST calendar date (YYYY-MM-DD). */
  @Index()
  @Column({ name: 'snapshot_date_kst', type: 'date' })
  snapshotDateKst: string;

  @Index()
  @Column({ name: 'category', type: 'varchar', length: 64 })
  category: string;

  @Column({ name: 'grade', type: 'varchar', length: 32 })
  grade: string;

  /** Top-100 card list for this day. */
  @Column({ name: 'cards_json', type: 'jsonb' })
  cardsJson: Top100Card[];

  @Column({ name: 'total_pages', type: 'int', default: 0 })
  totalPages: number;

  /** Exact moment the upstream CardHedger fetch completed. */
  @Column({ name: 'fetched_at', type: 'timestamptz' })
  fetchedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
