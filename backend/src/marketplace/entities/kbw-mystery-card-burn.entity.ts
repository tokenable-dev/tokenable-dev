import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Web2-only burn ledger for the synthetic KBW Mystery Card.
 * One row per email — after burn, every portfolio for that email hides the card.
 */
@Entity('kbw_mystery_card_burns')
export class KbwMysteryCardBurn {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ name: 'email', type: 'varchar', length: 320 })
  email: string;

  @CreateDateColumn({ name: 'burned_at', type: 'timestamptz' })
  burnedAt: Date;
}
