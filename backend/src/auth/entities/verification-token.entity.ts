import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VerificationTokenType } from '../verification-token-type';

@Entity('verification_tokens')
@Index('idx_verification_tokens_user_type_created', [
  'userId',
  'type',
  'createdAt',
])
export class VerificationToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index()
  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({
    type: 'enum',
    enum: VerificationTokenType,
    enumName: 'verification_token_type',
  })
  type: VerificationTokenType;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
