import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('marketplace_partners')
export class MarketplacePartner {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 128 })
  displayName!: string;

  @Index({ unique: true })
  @Column({ name: 'wallet_address', type: 'varchar', length: 42 })
  walletAddress!: string;

  /** AES-256-GCM blob — never expose via API. Null when partner is wallet-only (self vault). */
  @Column({ name: 'encrypted_private_key', type: 'text', nullable: true })
  encryptedPrivateKey!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
