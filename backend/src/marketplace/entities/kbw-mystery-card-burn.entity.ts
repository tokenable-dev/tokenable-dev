import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Web2-only burn ledger for the synthetic KBW Mystery Card.
 * One row per wallet — after burn the card stays out of Portfolio.
 */
@Entity('kbw_mystery_card_burns')
export class KbwMysteryCardBurn {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ name: 'wallet_address', type: 'varchar', length: 42 })
  walletAddress: string;

  @CreateDateColumn({ name: 'burned_at', type: 'timestamptz' })
  burnedAt: Date;
}
