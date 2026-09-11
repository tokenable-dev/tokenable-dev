import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export type UserWalletKind = 'embedded' | 'external';
export type UserWalletSource = 'privy_sync' | 'admin' | 'legacy';

@Entity('user_wallets')
@Unique('user_wallets_user_address_unique', ['userId', 'walletAddress'])
export class UserWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'wallet_address', type: 'varchar', length: 42 })
  walletAddress: string;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary: boolean;

  @Column({ name: 'chain_type', type: 'varchar', length: 16, default: 'ethereum' })
  chainType: string;

  @Column({ name: 'wallet_kind', type: 'varchar', length: 16, default: 'external' })
  walletKind: UserWalletKind;

  @Column({ name: 'wallet_client', type: 'varchar', length: 32, nullable: true })
  walletClient: string | null;

  @Column({ name: 'connector_type', type: 'varchar', length: 32, nullable: true })
  connectorType: string | null;

  @Column({ type: 'varchar', length: 32, default: 'legacy' })
  source: UserWalletSource;

  @Column({ name: 'privy_wallet_id', type: 'varchar', length: 128, nullable: true })
  privyWalletId: string | null;

  @CreateDateColumn({ name: 'linked_at', type: 'timestamptz' })
  linkedAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
