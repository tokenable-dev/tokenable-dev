import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserWallet } from './entities/user-wallet.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(UserWallet)
    private readonly userWallets: Repository<UserWallet>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  async findByIdOrFail(id: string): Promise<User> {
    const u = await this.findById(id);
    if (!u) throw new NotFoundException('User not found');
    return u;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: email.toLowerCase().trim() } });
  }

  async createWithPassword(params: {
    email: string;
    passwordHash: string;
    name?: string | null;
  }): Promise<User> {
    const user = this.users.create({
      email: params.email.toLowerCase().trim(),
      passwordHash: params.passwordHash,
      name: params.name?.trim() || null,
      googleId: null,
      emailVerified: false,
    });
    return this.users.save(user);
  }

  async findOrCreateFromGoogle(params: {
    googleId: string;
    email: string;
    name?: string | null;
    pictureUrl?: string | null;
    emailVerified?: boolean;
  }): Promise<User> {
    const existingByGoogle = await this.users.findOne({
      where: { googleId: params.googleId },
    });
    if (existingByGoogle) {
      await this.patchProfileIfNeeded(existingByGoogle, params);
      return existingByGoogle;
    }

    const existingByEmail = await this.users.findOne({
      where: { email: params.email.toLowerCase() },
    });
    if (existingByEmail) {
      if (
        existingByEmail.googleId &&
        existingByEmail.googleId !== params.googleId
      ) {
        throw new ConflictException('Email already linked to another account');
      }
      existingByEmail.googleId = params.googleId;
      existingByEmail.name = params.name ?? existingByEmail.name;
      existingByEmail.pictureUrl =
        params.pictureUrl ?? existingByEmail.pictureUrl;
      existingByEmail.emailVerified =
        params.emailVerified ?? existingByEmail.emailVerified;
      return this.users.save(existingByEmail);
    }

    const user = this.users.create({
      email: params.email.toLowerCase(),
      googleId: params.googleId,
      name: params.name ?? null,
      pictureUrl: params.pictureUrl ?? null,
      emailVerified: params.emailVerified ?? true,
    });
    return this.users.save(user);
  }

  private async patchProfileIfNeeded(
    user: User,
    params: {
      name?: string | null;
      pictureUrl?: string | null;
      emailVerified?: boolean;
    },
  ): Promise<void> {
    let dirty = false;
    if (params.name != null && params.name !== user.name) {
      user.name = params.name;
      dirty = true;
    }
    if (params.pictureUrl != null && params.pictureUrl !== user.pictureUrl) {
      user.pictureUrl = params.pictureUrl;
      dirty = true;
    }
    if (
      params.emailVerified !== undefined &&
      params.emailVerified !== user.emailVerified
    ) {
      user.emailVerified = params.emailVerified;
      dirty = true;
    }
    if (dirty) await this.users.save(user);
  }

  async listWalletsForUser(userId: string): Promise<UserWallet[]> {
    return this.userWallets.find({
      where: { userId },
      order: { isPrimary: 'DESC', linkedAt: 'ASC' },
    });
  }

  async findWalletByAddress(address: string): Promise<UserWallet | null> {
    return this.userWallets.findOne({ where: { walletAddress: address } });
  }

  /** Add a wallet to the user (does not remove existing wallets). */
  async addWalletAddress(userId: string, address: string): Promise<User> {
    const user = await this.findByIdOrFail(userId);
    const normalized = address;

    const existing = await this.findWalletByAddress(normalized);
    if (existing) {
      if (existing.userId === userId) {
        return user;
      }
      throw new ConflictException(
        'This wallet is already linked to another user',
      );
    }

    const count = await this.userWallets.count({ where: { userId } });
    const isPrimary = count === 0;

    const row = this.userWallets.create({
      userId,
      walletAddress: normalized,
      isPrimary,
    });
    await this.userWallets.save(row);

    if (isPrimary) {
      user.walletAddress = normalized;
      user.walletLinkedAt = row.linkedAt;
      return this.users.save(user);
    }

    return user;
  }

  async removeWallet(userId: string, address: string): Promise<User> {
    const user = await this.findByIdOrFail(userId);
    const normalized = address;
    const row = await this.userWallets.findOne({
      where: { userId, walletAddress: normalized },
    });
    if (!row) {
      throw new NotFoundException('Wallet not linked to this account');
    }

    const wasPrimary = row.isPrimary;
    await this.userWallets.remove(row);

    if (!wasPrimary) {
      return user;
    }

    const next = await this.userWallets.findOne({
      where: { userId },
      order: { linkedAt: 'ASC' },
    });

    if (next) {
      next.isPrimary = true;
      await this.userWallets.save(next);
      user.walletAddress = next.walletAddress;
      user.walletLinkedAt = next.linkedAt;
    } else {
      user.walletAddress = null;
      user.walletLinkedAt = null;
    }

    return this.users.save(user);
  }

  /** @deprecated Use addWalletAddress — kept for internal callers */
  async setWalletAddress(userId: string, address: string): Promise<User> {
    return this.addWalletAddress(userId, address);
  }

  /** @deprecated Use removeWallet — removes primary or sole wallet when address omitted */
  async clearWallet(userId: string): Promise<User> {
    const user = await this.findByIdOrFail(userId);
    const primary =
      (await this.userWallets.findOne({ where: { userId, isPrimary: true } })) ??
      (await this.userWallets.findOne({
        where: { userId },
        order: { linkedAt: 'ASC' },
      }));
    if (!primary) {
      user.walletAddress = null;
      user.walletLinkedAt = null;
      return this.users.save(user);
    }
    return this.removeWallet(userId, primary.walletAddress);
  }
}
