import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MarketplacePartner } from './marketplace-partner.entity';

/**
 * Partner company / vault Origin address — FedEx Rate shipper origin.
 * One active row per partner (UNIQUE partner_id).
 */
@Entity('marketplace_partner_addresses')
export class MarketplacePartnerAddress {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'partner_id', type: 'uuid' })
  partnerId!: string;

  @OneToOne(() => MarketplacePartner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partner_id' })
  partner?: MarketplacePartner;

  @Column({ name: 'company_name', type: 'varchar', length: 128 })
  companyName!: string;

  @Column({ name: 'contact_name', type: 'varchar', length: 128 })
  contactName!: string;

  @Column({ type: 'varchar', length: 40 })
  phone!: string;

  /** ISO 3166-1 alpha-2 (US, CA, KR, …) for FedEx Rate API. */
  @Column({ type: 'varchar', length: 2 })
  country!: string;

  @Column({ type: 'varchar', length: 128 })
  city!: string;

  /** State / province — required for US and CA in validation. */
  @Column({ type: 'varchar', length: 128, nullable: true })
  region!: string | null;

  @Column({ type: 'varchar', length: 32 })
  postal!: string;

  @Column({ type: 'varchar', length: 256 })
  line1!: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  line2!: string | null;

  /** FedEx Rate residential flag — company vault origins are commercial by default. */
  @Column({ type: 'boolean', default: false })
  residential!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
