import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export type ShippingCountry = 'us' | 'ca' | 'intl';

@Entity('user_shipping_addresses')
export class UserShippingAddress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 64, default: 'Home' })
  label: string;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'varchar', length: 256 })
  line1: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  line2: string | null;

  @Column({ type: 'varchar', length: 128 })
  city: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  region: string | null;

  @Column({ type: 'varchar', length: 32 })
  postal: string;

  @Column({ type: 'varchar', length: 8, default: 'us' })
  country: ShippingCountry;

  @Column({ type: 'varchar', length: 40 })
  phone: string;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
