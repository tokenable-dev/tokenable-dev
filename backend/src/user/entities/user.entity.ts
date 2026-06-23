import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Web2 account (Google OAuth and/or email/password) + optional wallet link.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 320, unique: true })
  email: string;

  /** Google OpenID subject (profile.id) */
  @Column({
    name: 'google_id',
    type: 'varchar',
    length: 64,
    unique: true,
    nullable: true,
  })
  googleId: string | null;

  /** scrypt hash — NULL for Google-only accounts */
  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  name: string | null;

  @Column({ name: 'picture_url', type: 'text', nullable: true })
  pictureUrl: string | null;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  /** Primary linked wallet (denormalized). Not globally unique — shared wallets allowed. */
  @Column({
    name: 'wallet_address',
    type: 'varchar',
    length: 42,
    nullable: true,
  })
  walletAddress: string | null;

  @Column({ name: 'wallet_linked_at', type: 'timestamptz', nullable: true })
  walletLinkedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
