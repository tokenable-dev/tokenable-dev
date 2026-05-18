import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Web2(구글) 계정 + (선택) 지갑 연동.
 *
 * 확장 시 고려: provider enum, refresh_tokens 테이블, 이메일 로그인, roles
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

  @Column({ type: 'varchar', length: 200, nullable: true })
  name: string | null;

  @Column({ name: 'picture_url', type: 'text', nullable: true })
  pictureUrl: string | null;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  /** 플랫폼 이메일 인증 링크 클릭 완료 시각 (구글 OAuth와 별개) */
  @Column({
    name: 'platform_email_verified_at',
    type: 'timestamptz',
    nullable: true,
  })
  platformEmailVerifiedAt: Date | null;

  @Column({
    name: 'email_verification_token_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  emailVerificationTokenHash: string | null;

  @Column({
    name: 'email_verification_expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  emailVerificationExpiresAt: Date | null;

  @Column({
    name: 'verification_email_last_sent_at',
    type: 'timestamptz',
    nullable: true,
  })
  verificationEmailLastSentAt: Date | null;

  /** 체크섬 정규화 주소 (0x…). NULL 허용·UNIQUE — PostgreSQL에서 NULL은 중복 허용 */
  @Column({
    name: 'wallet_address',
    type: 'varchar',
    length: 42,
    unique: true,
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
