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

/** Linked login method (email OTP, OAuth, wallet, passkey, Privy root, etc.). */
@Entity('user_auth_providers')
export class UserAuthProvider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'provider_type', type: 'varchar', length: 32 })
  providerType: string;

  /** Stable identifier within the provider (email, OAuth sub, wallet address, Privy DID). */
  @Column({ name: 'provider_subject', type: 'varchar', length: 256 })
  providerSubject: string;

  @Column({ name: 'provider_account_id', type: 'varchar', length: 128, nullable: true })
  providerAccountId: string | null;

  @Column({ type: 'varchar', length: 320, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone: string | null;

  @Column({ name: 'display_name', type: 'varchar', length: 200, nullable: true })
  displayName: string | null;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @Column({ name: 'linked_at', type: 'timestamptz', default: () => 'now()' })
  linkedAt: Date;

  @Column({ name: 'unlinked_at', type: 'timestamptz', nullable: true })
  unlinkedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
