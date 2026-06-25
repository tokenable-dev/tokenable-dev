import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getAddress } from 'ethers';
import { Repository } from 'typeorm';
import { EmailVerificationService } from '../../auth/email-verification.service';
import { PasswordResetService } from '../../auth/password-reset.service';
import { hashPassword } from '../../auth/password.util';
import { VerificationToken } from '../../auth/entities/verification-token.entity';
import { VerificationTokenType } from '../../auth/verification-token-type';
import { User } from '../../user/entities/user.entity';
import { UserWallet } from '../../user/entities/user-wallet.entity';
import { UserService } from '../../user/user.service';
import { UserWatchlist } from '../entities/user-watchlist.entity';
import type {
  AdminUpdateUserDto,
  AdminUserListQueryDto,
} from './dto/admin-user.dto';

export type AdminUserSummary = {
  id: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
  emailVerified: boolean;
  googleId: string | null;
  hasPassword: boolean;
  signupType: 'google' | 'email' | 'google+email';
  walletAddress: string | null;
  walletLinkedAt: string | null;
  walletCount: number;
  watchlistCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserWalletRow = {
  id: string;
  walletAddress: string;
  isPrimary: boolean;
  linkedAt: string;
};

export type AdminUserDetail = AdminUserSummary & {
  wallets: AdminUserWalletRow[];
  watchlistKeys: string[];
  pendingEmailVerification: boolean;
  pendingPasswordReset: boolean;
};

export type AdminUserStats = {
  total: number;
  verified: number;
  unverified: number;
  googleOnly: number;
  emailPassword: number;
  withWallet: number;
};

function signupType(user: User): AdminUserSummary['signupType'] {
  const hasGoogle = Boolean(user.googleId);
  const hasPassword = Boolean(user.passwordHash);
  if (hasGoogle && hasPassword) return 'google+email';
  if (hasGoogle) return 'google';
  return 'email';
}

function toSummary(
  user: User,
  walletCount: number,
  watchlistCount: number,
): AdminUserSummary {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    pictureUrl: user.pictureUrl,
    emailVerified: user.emailVerified,
    googleId: user.googleId,
    hasPassword: Boolean(user.passwordHash),
    signupType: signupType(user),
    walletAddress: user.walletAddress,
    walletLinkedAt: user.walletLinkedAt?.toISOString() ?? null,
    walletCount,
    watchlistCount,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

@Injectable()
export class UserAdminService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(UserWallet)
    private readonly walletsRepo: Repository<UserWallet>,
    @InjectRepository(UserWatchlist)
    private readonly watchlistRepo: Repository<UserWatchlist>,
    @InjectRepository(VerificationToken)
    private readonly tokensRepo: Repository<VerificationToken>,
    private readonly users: UserService,
    private readonly emailVerification: EmailVerificationService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  async getStats(): Promise<AdminUserStats> {
    const raw = await this.usersRepo
      .createQueryBuilder('u')
      .select('COUNT(*)::int', 'total')
      .addSelect(
        'COUNT(*) FILTER (WHERE u.email_verified = true)::int',
        'verified',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE u.email_verified = false)::int',
        'unverified',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE u.google_id IS NOT NULL AND u.password_hash IS NULL)::int',
        'googleOnly',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE u.password_hash IS NOT NULL)::int',
        'emailPassword',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE u.wallet_address IS NOT NULL)::int',
        'withWallet',
      )
      .getRawOne<{
        total: number;
        verified: number;
        unverified: number;
        googleOnly: number;
        emailPassword: number;
        withWallet: number;
      }>();
    return {
      total: raw?.total ?? 0,
      verified: raw?.verified ?? 0,
      unverified: raw?.unverified ?? 0,
      googleOnly: raw?.googleOnly ?? 0,
      emailPassword: raw?.emailPassword ?? 0,
      withWallet: raw?.withWallet ?? 0,
    };
  }

  async listUsers(query: AdminUserListQueryDto): Promise<{
    items: AdminUserSummary[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 30, 100);
    const skip = (page - 1) * limit;
    const filter = query.filter ?? 'all';

    const qb = this.usersRepo.createQueryBuilder('u');
    const q = query.q?.trim().toLowerCase();
    if (q) {
      qb.andWhere(
        `(LOWER(u.email) LIKE :q
          OR LOWER(COALESCE(u.name, '')) LIKE :q
          OR LOWER(COALESCE(u.wallet_address, '')) LIKE :q
          OR EXISTS (
            SELECT 1 FROM user_wallets w
            WHERE w.user_id = u.id AND LOWER(w.wallet_address) LIKE :q
          ))`,
        { q: `%${q}%` },
      );
    }

    if (filter === 'google') {
      qb.andWhere('u.google_id IS NOT NULL');
    } else if (filter === 'email') {
      qb.andWhere('u.password_hash IS NOT NULL');
    } else if (filter === 'verified') {
      qb.andWhere('u.email_verified = true');
    } else if (filter === 'unverified') {
      qb.andWhere('u.email_verified = false');
    }

    qb.orderBy('u.created_at', 'DESC').skip(skip).take(limit);
    const [rows, total] = await qb.getManyAndCount();

    const ids = rows.map((r) => r.id);
    const walletCounts = await this.countByUserIds(
      this.walletsRepo,
      'user_id',
      ids,
    );
    const watchCounts = await this.countByUserIds(
      this.watchlistRepo,
      'user_id',
      ids,
    );

    const items = rows.map((user) =>
      toSummary(
        user,
        walletCounts.get(user.id) ?? 0,
        watchCounts.get(user.id) ?? 0,
      ),
    );

    return {
      items,
      total,
      page,
      limit,
      hasMore: skip + rows.length < total,
    };
  }

  async getUserDetail(userId: string): Promise<AdminUserDetail> {
    const user = await this.users.findByIdOrFail(userId);
    const [wallets, watchlistRows, pending] = await Promise.all([
      this.users.listWalletsForUser(userId),
      this.watchlistRepo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 200,
      }),
      this.pendingTokenFlags(userId),
    ]);

    const summary = toSummary(user, wallets.length, watchlistRows.length);
    return {
      ...summary,
      wallets: wallets.map((w) => ({
        id: w.id,
        walletAddress: w.walletAddress,
        isPrimary: w.isPrimary,
        linkedAt: w.linkedAt.toISOString(),
      })),
      watchlistKeys: watchlistRows.map((r) => r.collectionKey),
      pendingEmailVerification: pending.emailVerify,
      pendingPasswordReset: pending.passwordReset,
    };
  }

  async updateUser(userId: string, dto: AdminUpdateUserDto): Promise<AdminUserDetail> {
    const user = await this.users.findByIdOrFail(userId);
    if (dto.name !== undefined) {
      user.name = dto.name?.trim() || null;
    }
    if (dto.emailVerified !== undefined) {
      user.emailVerified = dto.emailVerified;
    }
    await this.usersRepo.save(user);
    return this.getUserDetail(userId);
  }

  async deleteUser(userId: string): Promise<{ ok: true }> {
    await this.users.deleteById(userId);
    return { ok: true };
  }

  async resendVerificationEmail(userId: string): Promise<{ ok: true }> {
    await this.emailVerification.adminIssueVerification(userId);
    return { ok: true };
  }

  async sendPasswordResetEmail(userId: string): Promise<{ ok: true }> {
    await this.passwordReset.adminRequestResetForUserId(userId);
    return { ok: true };
  }

  async setPassword(userId: string, password: string): Promise<{ ok: true }> {
    await this.users.updatePasswordHash(userId, hashPassword(password));
    return { ok: true };
  }

  async forceVerifyEmail(userId: string): Promise<AdminUserDetail> {
    const user = await this.users.findByIdOrFail(userId);
    user.emailVerified = true;
    await this.usersRepo.save(user);
    await this.tokensRepo.delete({ userId });
    return this.getUserDetail(userId);
  }

  async clearPendingTokens(userId: string): Promise<{ ok: true }> {
    await this.users.findByIdOrFail(userId);
    await this.tokensRepo.delete({ userId });
    return { ok: true };
  }

  async linkWallet(userId: string, address: string): Promise<AdminUserDetail> {
    const normalized = getAddress(address);
    await this.users.addWalletAddress(userId, normalized);
    return this.getUserDetail(userId);
  }

  async unlinkWallet(
    userId: string,
    address: string,
  ): Promise<AdminUserDetail> {
    const normalized = getAddress(address);
    await this.users.removeWallet(userId, normalized);
    return this.getUserDetail(userId);
  }

  async removeWatchlistItem(
    userId: string,
    collectionKey: string,
  ): Promise<AdminUserDetail> {
    await this.users.findByIdOrFail(userId);
    const key = decodeURIComponent(collectionKey).trim().toLowerCase();
    if (!key) throw new BadRequestException('collectionKey is required');
    await this.watchlistRepo.delete({ userId, collectionKey: key });
    return this.getUserDetail(userId);
  }

  private async pendingTokenFlags(
    userId: string,
  ): Promise<{ emailVerify: boolean; passwordReset: boolean }> {
    const rows = await this.tokensRepo.find({
      where: { userId },
      select: ['type', 'expiresAt'],
    });
    const now = Date.now();
    let emailVerify = false;
    let passwordReset = false;
    for (const row of rows) {
      if (row.expiresAt.getTime() < now) continue;
      if (row.type === VerificationTokenType.EMAIL_VERIFY) emailVerify = true;
      if (row.type === VerificationTokenType.PASSWORD_RESET) passwordReset = true;
    }
    return { emailVerify, passwordReset };
  }

  private async countByUserIds(
    repo: Repository<{ userId: string }>,
    column: string,
    userIds: string[],
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (userIds.length === 0) return out;
    const rows = await repo
      .createQueryBuilder('t')
      .select(`t.${column}`, 'userId')
      .addSelect('COUNT(*)::int', 'cnt')
      .where(`t.${column} IN (:...userIds)`, { userIds })
      .groupBy(`t.${column}`)
      .getRawMany<{ userId: string; cnt: number }>();
    for (const row of rows) {
      out.set(row.userId, row.cnt);
    }
    return out;
  }
}
