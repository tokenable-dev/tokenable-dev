import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Singleton row (id=1) — last `since` for price-updates delta polling. */
@Entity('cardhedger_price_delta_checkpoints')
export class CardhedgerPriceDeltaCheckpoint {
  @PrimaryColumn({ type: 'smallint', default: 1 })
  id: number;

  @Column({ name: 'last_since_iso', type: 'varchar', length: 40 })
  lastSinceIso: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
