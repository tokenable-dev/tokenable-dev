import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * PSA Public API cert body cache — keyed by cert digits (not collection bucket).
 * Replaces per-row `marketplace_collections.psa_public_snapshot_*`.
 */
@Entity('psa_cert_snapshots')
export class PsaCertSnapshot {
  @PrimaryColumn({ name: 'cert_number', type: 'varchar', length: 32 })
  certNumber: string;

  @Column({ name: 'snapshot_json', type: 'jsonb' })
  snapshotJson: Record<string, unknown>;

  @UpdateDateColumn({ name: 'fetched_at' })
  fetchedAt: Date;
}
