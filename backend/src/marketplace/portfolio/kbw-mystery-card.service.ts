import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { isWalletOnlyPlaceholderEmail } from '../../auth/privy/privy-user.parser';
import { UserAuthProvider } from '../../user/entities/user-auth-provider.entity';
import { User } from '../../user/entities/user.entity';
import { UserWallet } from '../../user/entities/user-wallet.entity';
import { KbwMysteryCardBurn } from '../entities/kbw-mystery-card-burn.entity';

@Injectable()
export class KbwMysteryCardService {
  constructor(
    @InjectRepository(KbwMysteryCardBurn)
    private readonly burns: Repository<KbwMysteryCardBurn>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(UserWallet)
    private readonly userWallets: Repository<UserWallet>,
    @InjectRepository(UserAuthProvider)
    private readonly authProviders: Repository<UserAuthProvider>,
  ) {}

  private normalizeWallet(walletAddress: string): string {
    return walletAddress.trim().toLowerCase();
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private contactEmailsOnly(emails: string[]): string[] {
    return [
      ...new Set(
        emails
          .map((e) => this.normalizeEmail(e))
          .filter((e) => e.length > 0 && !isWalletOnlyPlaceholderEmail(e)),
      ),
    ];
  }

  /** Real contact inboxes for this account (users.email + linked OAuth/email providers). */
  async contactEmailsForUser(user: User): Promise<string[]> {
    const providers = await this.authProviders.find({
      where: { userId: user.id, unlinkedAt: IsNull() },
      select: ['email'],
    });
    return this.contactEmailsOnly([
      user.email ?? '',
      ...providers.map((p) => p.email ?? ''),
    ]);
  }

  /** Signed-in user only — any linked contact email may mark the card used. */
  async isBurnedForUser(user: User): Promise<boolean> {
    const emails = await this.contactEmailsForUser(user);
    if (emails.length === 0) return false;
    const row = await this.burns.findOne({ where: { email: In(emails) } });
    return Boolean(row);
  }

  /** Contact emails linked to this wallet (primary + user_wallets). */
  async emailsForWallet(walletAddress: string): Promise<string[]> {
    const wallet = this.normalizeWallet(walletAddress);
    if (!wallet) return [];

    const linked = await this.userWallets
      .createQueryBuilder('w')
      .select('w.user_id', 'userId')
      .where('LOWER(w.wallet_address) = :wallet', { wallet })
      .getRawMany<{ userId: string }>();

    const primary = await this.users
      .createQueryBuilder('u')
      .select('u.id', 'id')
      .where('LOWER(u.wallet_address) = :wallet', { wallet })
      .getRawMany<{ id: string }>();

    const userIds = [
      ...new Set([
        ...linked.map((r) => r.userId).filter(Boolean),
        ...primary.map((r) => r.id).filter(Boolean),
      ]),
    ];
    if (userIds.length === 0) return [];

    const rows = await this.users.find({
      where: { id: In(userIds) },
      select: ['email'],
    });
    return [
      ...new Set(
        rows
          .map((u) => this.normalizeEmail(u.email ?? ''))
          .filter((e) => e.length > 0),
      ),
    ];
  }

  async isBurned(walletAddress: string): Promise<boolean> {
    const emails = this.contactEmailsOnly(
      await this.emailsForWallet(walletAddress),
    );
    if (emails.length === 0) return false;
    const row = await this.burns.findOne({ where: { email: In(emails) } });
    return Boolean(row);
  }

  async burnForUser(
    user: User,
  ): Promise<{ burned: true; alreadyBurned: boolean }> {
    const emails = await this.contactEmailsForUser(user);
    if (emails.length === 0) {
      throw new BadRequestException(
        'Add a contact email before claiming the KBW mystery card',
      );
    }

    let alreadyBurned = false;
    for (const email of emails) {
      const existing = await this.burns.findOne({ where: { email } });
      if (existing) {
        alreadyBurned = true;
        continue;
      }
      await this.burns.save(this.burns.create({ email }));
    }
    return { burned: true, alreadyBurned };
  }

  /** @deprecated Prefer {@link burnForUser} — wallet-wide email union caused false burns. */
  async burn(
    walletAddress: string,
  ): Promise<{ burned: true; alreadyBurned: boolean }> {
    const emails = this.contactEmailsOnly(
      await this.emailsForWallet(walletAddress),
    );
    if (emails.length === 0) {
      throw new BadRequestException(
        'No account email linked to this wallet — sign in before burning',
      );
    }

    let alreadyBurned = false;
    for (const email of emails) {
      const existing = await this.burns.findOne({ where: { email } });
      if (existing) {
        alreadyBurned = true;
        continue;
      }
      await this.burns.save(this.burns.create({ email }));
    }
    return { burned: true, alreadyBurned };
  }
}
