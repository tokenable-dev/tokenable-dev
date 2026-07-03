import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getAddress } from 'ethers';
import { Repository } from 'typeorm';
import { isWalletOnlyPlaceholderEmail } from '../../auth/privy/privy-user.parser';
import { UserAuthProvider } from '../../user/entities/user-auth-provider.entity';
import { User } from '../../user/entities/user.entity';
import { UserWallet } from '../../user/entities/user-wallet.entity';
import { UserService } from '../../user/user.service';
import { UserWatchlist } from '../entities/user-watchlist.entity';
import type {
  AdminUpdateUserDto,
  AdminUserListQueryDto,
} from './dto/admin-user.dto';

/** How the user authenticates — derived from Privy linked accounts. */
export type AdminPrivyAuthMethod =
  | 'wallet'
  | 'google'
  | 'email'
  | 'google+email'
  | 'apple'
  | 'other'
  | 'legacy';

export type AdminAuthProviderRow = {
  id: string;
  providerType: string;
  providerSubject: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  isVerified: boolean;
  linkedAt: string;
};

export type AdminUserSummary = {
  id: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
  emailVerified: boolean;
  privyAuthMethod: AdminPrivyAuthMethod;
  privyId: string | null;
  authProviderTypes: string[];
  kycStatus: User['kycStatus'];
  kycVerifiedAt: string | null;
  walletAddress: string | null;
  walletLinkedAt: string | null;
  walletCount: number;
  watchlistCount: number;
  lastPrivySyncAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserWalletRow = {
  id: string;
  walletAddress: string;
  isPrimary: boolean;
  chainType: string;
  walletKind: UserWallet['walletKind'];
  walletClient: string | null;
  connectorType: string | null;
  source: UserWallet['source'];
  linkedAt: string;
};

export type AdminUserDetail = AdminUserSummary & {
  wallets: AdminUserWalletRow[];
  authProviders: AdminAuthProviderRow[];
  watchlistKeys: string[];
  kycProvider: string | null;
  kycExternalId: string | null;
  kycRejectionReason: string | null;
};

export type AdminUserStats = {
  total: number;
  privy: number;
  legacy: number;
  google: number;
  emailOtp: number;
  walletLogin: number;
  withWallet: number;
  kycApproved: number;
  kycPending: number;
  verified: number;
  unverified: number;
};

function deriveAdminPrivyAuthMethod(
  user: User,
  providerTypes: string[],
): AdminPrivyAuthMethod {
  const types = new Set(providerTypes);
  if (!user.privyId && !types.has('privy')) {
    return 'legacy';
  }

  const hasWallet = types.has('wallet');
  const hasGoogle = types.has('google_oauth') || Boolean(user.googleId);
  const hasEmail = types.has('email');
  const hasApple = types.has('apple_oauth');

  if (hasWallet && !hasGoogle && !hasEmail && !hasApple) return 'wallet';
  if (hasGoogle && hasEmail) return 'google+email';
  if (hasGoogle) return 'google';
  if (hasEmail) return 'email';
  if (hasApple) return 'apple';
  if (hasWallet) return 'other';
  return 'other';
}

/** @internal exported for unit tests */
export const privyAuthMethod = deriveAdminPrivyAuthMethod;

function toSummary(
  user: User,
  walletCount: number,
  watchlistCount: number,
  authProviderTypes: string[],
): AdminUserSummary {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    pictureUrl: user.pictureUrl,
    emailVerified: user.emailVerified,
    privyAuthMethod: deriveAdminPrivyAuthMethod(user, authProviderTypes),
    privyId: user.privyId,
    authProviderTypes,
    kycStatus: user.kycStatus,
    kycVerifiedAt: user.kycVerifiedAt?.toISOString() ?? null,
    walletAddress: user.walletAddress,
    walletLinkedAt: user.walletLinkedAt?.toISOString() ?? null,
    walletCount,
    watchlistCount,
    lastPrivySyncAt: user.lastPrivySyncAt?.toISOString() ?? null,
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
    @InjectRepository(UserAuthProvider)
    private readonly authProvidersRepo: Repository<UserAuthProvider>,
    @InjectRepository(UserWatchlist)
    private readonly watchlistRepo: Repository<UserWatchlist>,
    private readonly users: UserService,
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
        'COUNT(*) FILTER (WHERE u.privy_id IS NOT NULL)::int',
        'privy',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE u.privy_id IS NULL)::int',
        'legacy',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM user_auth_providers p
          WHERE p.user_id = u.id AND p.unlinked_at IS NULL AND p.provider_type = 'google_oauth'
        ))::int`,
        'google',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM user_auth_providers p
          WHERE p.user_id = u.id AND p.unlinked_at IS NULL AND p.provider_type = 'email'
        ))::int`,
        'emailOtp',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM user_auth_providers p
          WHERE p.user_id = u.id AND p.unlinked_at IS NULL AND p.provider_type = 'wallet'
        ))::int`,
        'walletLogin',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE u.wallet_address IS NOT NULL)::int',
        'withWallet',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE u.kyc_status = 'approved')::int",
        'kycApproved',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE u.kyc_status = 'pending')::int",
        'kycPending',
      )
      .getRawOne<{
        total: number;
        verified: number;
        unverified: number;
        privy: number;
        legacy: number;
        google: number;
        emailOtp: number;
        walletLogin: number;
        withWallet: number;
        kycApproved: number;
        kycPending: number;
      }>();
    return {
      total: raw?.total ?? 0,
      verified: raw?.verified ?? 0,
      unverified: raw?.unverified ?? 0,
      privy: raw?.privy ?? 0,
      legacy: raw?.legacy ?? 0,
      google: raw?.google ?? 0,
      emailOtp: raw?.emailOtp ?? 0,
      walletLogin: raw?.walletLogin ?? 0,
      withWallet: raw?.withWallet ?? 0,
      kycApproved: raw?.kycApproved ?? 0,
      kycPending: raw?.kycPending ?? 0,
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
          OR LOWER(COALESCE(u.privy_id, '')) LIKE :q
          OR EXISTS (
            SELECT 1 FROM user_wallets w
            WHERE w.user_id = u.id AND LOWER(w.wallet_address) LIKE :q
          )
          OR EXISTS (
            SELECT 1 FROM user_auth_providers p
            WHERE p.user_id = u.id
              AND p.unlinked_at IS NULL
              AND (
                LOWER(COALESCE(p.email, '')) LIKE :q
                OR LOWER(p.provider_subject) LIKE :q
              )
          ))`,
        { q: `%${q}%` },
      );
    }

    if (filter === 'legacy') {
      qb.andWhere('u.privy_id IS NULL');
    } else if (filter === 'google') {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM user_auth_providers p
          WHERE p.user_id = u.id AND p.unlinked_at IS NULL AND p.provider_type = 'google_oauth'
        )`,
      );
    } else if (filter === 'email') {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM user_auth_providers p
          WHERE p.user_id = u.id AND p.unlinked_at IS NULL AND p.provider_type = 'email'
        )`,
      );
    } else if (filter === 'wallet') {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM user_auth_providers p
          WHERE p.user_id = u.id AND p.unlinked_at IS NULL AND p.provider_type = 'wallet'
        )`,
      );
    } else if (filter === 'privy') {
      qb.andWhere('u.privy_id IS NOT NULL');
    } else if (filter === 'verified') {
      qb.andWhere('u.email_verified = true');
    } else if (filter === 'unverified') {
      qb.andWhere('u.email_verified = false');
    } else if (filter === 'kyc_approved') {
      qb.andWhere("u.kyc_status = 'approved'");
    } else if (filter === 'kyc_pending') {
      qb.andWhere("u.kyc_status = 'pending'");
    } else if (filter === 'with_wallet') {
      qb.andWhere('u.wallet_address IS NOT NULL');
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
    const providerTypesByUser = await this.providerTypesByUserIds(ids);

    const items = rows.map((user) =>
      toSummary(
        user,
        walletCounts.get(user.id) ?? 0,
        watchCounts.get(user.id) ?? 0,
        providerTypesByUser.get(user.id) ?? [],
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
    const [wallets, authProviders, watchlistRows] = await Promise.all([
      this.users.listWalletsForUser(userId),
      this.users.listAuthProvidersForUser(userId),
      this.watchlistRepo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 200,
      }),
    ]);

    const authProviderTypes = authProviders.map((p) => p.providerType);
    const summary = toSummary(
      user,
      wallets.length,
      watchlistRows.length,
      authProviderTypes,
    );

    return {
      ...summary,
      wallets: wallets.map((w) => ({
        id: w.id,
        walletAddress: w.walletAddress,
        isPrimary: w.isPrimary,
        chainType: w.chainType,
        walletKind: w.walletKind,
        walletClient: w.walletClient,
        connectorType: w.connectorType,
        source: w.source,
        linkedAt: w.linkedAt.toISOString(),
      })),
      authProviders: authProviders.map((p) => ({
        id: p.id,
        providerType: p.providerType,
        providerSubject: p.providerSubject,
        email: p.email,
        phone: p.phone,
        displayName: p.displayName,
        isVerified: p.isVerified,
        linkedAt: p.linkedAt.toISOString(),
      })),
      watchlistKeys: watchlistRows.map((r) => r.collectionKey),
      kycProvider: user.kycProvider,
      kycExternalId: user.kycExternalId,
      kycRejectionReason: user.kycRejectionReason,
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

  async forceVerifyEmail(userId: string): Promise<AdminUserDetail> {
    const user = await this.users.findByIdOrFail(userId);
    user.emailVerified = true;
    await this.usersRepo.save(user);
    return this.getUserDetail(userId);
  }

  async linkWallet(userId: string, address: string): Promise<AdminUserDetail> {
    const normalized = getAddress(address);
    await this.users.addWalletAddress(userId, normalized, { source: 'admin' });
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

  private async providerTypesByUserIds(
    userIds: string[],
  ): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>();
    if (userIds.length === 0) return out;

    const rows = await this.authProvidersRepo
      .createQueryBuilder('p')
      .select('p.user_id', 'userId')
      .addSelect('array_agg(DISTINCT p.provider_type ORDER BY p.provider_type)', 'types')
      .where('p.user_id IN (:...userIds)', { userIds })
      .andWhere('p.unlinked_at IS NULL')
      .groupBy('p.user_id')
      .getRawMany<{ userId: string; types: string[] }>();

    for (const row of rows) {
      out.set(row.userId, row.types ?? []);
    }
    return out;
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

/** Human-readable email label for admin (mask wallet-only placeholders). */
export function formatAdminUserEmail(email: string): string {
  if (isWalletOnlyPlaceholderEmail(email)) {
    const wallet = email.replace(/@privy\.wallet$/i, '');
    return `${wallet.slice(0, 6)}…${wallet.slice(-4)} (wallet-only)`;
  }
  return email;
}
