import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/** Public cover-bucket object for one seller photo. Not a collection cover or slab. */
@Entity('pricecharting_listing_photos')
export class PricechartingListingPhoto {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Index()
  @Column({ name: 'listing_id', type: 'uuid' })
  listingId: string;

  @Column({ name: 'object_key', type: 'varchar', length: 512 })
  objectKey: string;

  @Column({ name: 'public_url', type: 'text' })
  publicUrl: string;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
