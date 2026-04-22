import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('hidden_assets')
@Index(['walletAddress', 'tokenId'], { unique: true })
export class HiddenAsset {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'wallet_address', type: 'varchar', length: 64 })
  walletAddress: string;

  @Column({ name: 'token_id', type: 'int' })
  tokenId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
