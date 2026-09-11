import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getAddress } from 'ethers';
import { In, Repository } from 'typeorm';
import { isWalletOnlyPlaceholderEmail } from '../../auth/privy/privy-user.parser';
import { UserAuthProvider } from '../../user/entities/user-auth-provider.entity';
import {
  UserKycEvent,
  type KycStatusValue,
} from '../../user/entities/user-kyc-event.entity';
import { User } from '../../user/entities/user.entity';
import { UserWallet } from '../../user/entities/user-wallet.entity';
import { UserService } from '../../user/user.service';
import { VaultCycle } from '../../vault/entities/vault-cycle.entity';
import { MarketplacePartner } from '../entities/marketplace-partner.entity';
import { UserWatchlist } from '../entities/user-watchlist.entity';
import type {
  AdminUpdateUserDto,
  AdminUpdateUserKycDto,
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

export type AdminUserPartnerInfo = {
  id: string;
  displayName: string;
  walletAddress: string;
  isActive: boolean;
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
  /** Derived from wallet ∩ marketplace_partners. */
  role: 'partner' | 'individual';
  partner: AdminUserPartnerInfo | null;
  /** Live vault cycles (status=minted) deposited by this user. */
  custodyCardCount: number;
  /** Moderation placeholder until strike/restrict schema exists. */
  accountStatus: 'active';
  strikeCount: number;
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
  privyWalletId: string | null;
  linkedAt: string;
};

export type AdminKycEventRow = {
  id: string;
  status: KycStatusValue;
  provider: string;
  externalId: string | null;
  reason: string | null;
  source: string | null;
  createdAt: string;
};

export type AdminUserDetail = AdminUserSummary & {
  wallets: AdminUserWalletRow[];
  authProviders: AdminAuthProviderRow[];
  watchlistKeys: string[];
  hasPassword: boolean;
  googleId: string | null;
  kycProvider: string | null;
  kycExternalId: string | null;
  kycRejectionReason: string | null;
  kycEvents: AdminKycEventRow[];
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
  kycRejected: number;
  kycNone: number;
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
  partner: AdminUserPartnerInfo | null,
  custodyCardCount: number,
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
    role: partner ? 'partner' : 'individual',
    partner,
    custodyCardCount,
    accountStatus: 'active',
    strikeCount: 0,
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
    @InjectRepository(UserKycEvent)
    private readonly kycEventsRepo: Repository<UserKycEvent>,
    @InjectRepository(MarketplacePartner)
    private readonly partnersRepo: Repository<MarketplacePartner>,
    @InjectRepository(VaultCycle)
    private readonly vaultCyclesRepo: Repository<VaultCycle>,
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
      .addSelect(
        "COUNT(*) FILTER (WHERE u.kyc_status = 'rejected')::int",
        'kycRejected',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE u.kyc_status = 'none')::int",
        'kycNone',
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
        kycRejected: number;
        kycNone: number;
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
      kycRejected: raw?.kycRejected ?? 0,
      kycNone: raw?.kycNone ?? 0,
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
    const accountStatus = query.accountStatus ?? 'all';

    // Moderation statuses are UI-only until strike/restrict schema exists.
    if (accountStatus === 'restricted' || accountStatus === 'suspended') {
      return { items: [], total: 0, page, limit, hasMore: false };
    }

    const qb = this.usersRepo.createQueryBuilder('u');
    const q = query.q?.trim().toLowerCase();
    if (q) {
      qb.andWhere(
        `(LOWER(u.email) LIKE :q
          OR LOWER(COALESCE(u.name, '')) LIKE :q
          OR LOWER(COALESCE(u.wallet_address, '')) LIKE :q
          OR LOWER(COALESCE(u.privy_id, '')) LIKE :q
          OR LOWER(COALESCE(u.kyc_external_id, '')) LIKE :q
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
    } else if (filter === 'kyc_rejected') {
      qb.andWhere("u.kyc_status = 'rejected'");
    } else if (filter === 'kyc_none') {
      qb.andWhere("u.kyc_status = 'none'");
    } else if (filter === 'with_wallet') {
      qb.andWhere('u.wallet_address IS NOT NULL');
    }

    const partnerWalletExists = `EXISTS (
      SELECT 1 FROM user_wallets w
      INNER JOIN marketplace_partners mp
        ON LOWER(mp.wallet_address) = LOWER(w.wallet_address)
      WHERE w.user_id = u.id
    ) OR EXISTS (
      SELECT 1 FROM marketplace_partners mp
      WHERE u.wallet_address IS NOT NULL
        AND LOWER(mp.wallet_address) = LOWER(u.wallet_address)
    )`;

    if (query.role === 'partner') {
      qb.andWhere(partnerWalletExists);
    } else if (query.role === 'individual') {
      qb.andWhere(`NOT (${partnerWalletExists})`);
    }

    qb.orderBy('u.created_at', 'DESC').skip(skip).take(limit);
    const [rows, total] = await qb.getManyAndCount();

    const ids = rows.map((r) => r.id);
    const [
      walletCounts,
      watchCounts,
      providerTypesByUser,
      partnersByUser,
      custodyByUser,
    ] = await Promise.all([
      this.countByUserIds(this.walletsRepo, 'user_id', ids),
      this.countByUserIds(this.watchlistRepo, 'user_id', ids),
      this.providerTypesByUserIds(ids),
      this.partnersByUserIds(ids, rows),
      this.custodyCardCountsByUserIds(ids),
    ]);

    const items = rows.map((user) =>
      toSummary(
        user,
        walletCounts.get(user.id) ?? 0,
        watchCounts.get(user.id) ?? 0,
        providerTypesByUser.get(user.id) ?? [],
        partnersByUser.get(user.id) ?? null,
        custodyByUser.get(user.id) ?? 0,
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
    const [
      wallets,
      authProviders,
      watchlistRows,
      kycEvents,
      partnersByUser,
      custodyByUser,
    ] = await Promise.all([
      this.users.listWalletsForUser(userId),
      this.users.listAuthProvidersForUser(userId),
      this.watchlistRepo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 200,
      }),
      this.kycEventsRepo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 50,
      }),
      this.partnersByUserIds([userId], [user]),
      this.custodyCardCountsByUserIds([userId]),
    ]);

    const authProviderTypes = authProviders.map((p) => p.providerType);
    const summary = toSummary(
      user,
      wallets.length,
      watchlistRows.length,
      authProviderTypes,
      partnersByUser.get(userId) ?? null,
      custodyByUser.get(userId) ?? 0,
    );

    return {
      ...summary,
      hasPassword: Boolean(user.passwordHash),
      googleId: user.googleId,
      wallets: wallets.map((w) => ({
        id: w.id,
        walletAddress: w.walletAddress,
        isPrimary: w.isPrimary,
        chainType: w.chainType,
        walletKind: w.walletKind,
        walletClient: w.walletClient,
        connectorType: w.connectorType,
        source: w.source,
        privyWalletId: w.privyWalletId,
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
      kycEvents: kycEvents.map((e) => ({
        id: e.id,
        status: e.status,
        provider: e.provider,
        externalId: e.externalId,
        reason: e.reason,
        source:
          typeof e.payload?.source === 'string' ? e.payload.source : null,
        createdAt: e.createdAt.toISOString(),
      })),
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

  async updateUserKyc(
    userId: string,
    dto: AdminUpdateUserKycDto,
  ): Promise<AdminUserDetail> {
    const user = await this.users.findByIdOrFail(userId);
    if (dto.status === 'rejected' && !dto.reason?.trim()) {
      throw new BadRequestException('reason is required when rejecting KYC');
    }
    await this.users.updateKycStatus(userId, {
      status: dto.status,
      provider: user.kycProvider ?? 'admin',
      externalId: user.kycExternalId,
      reason: dto.reason?.trim() || null,
      payload: { source: 'admin' },
    });
    return this.getUserDetail(userId);
  }

  private async partnersByUserIds(
    userIds: string[],
    users: User[],
  ): Promise<Map<string, AdminUserPartnerInfo>> {
    const out = new Map<string, AdminUserPartnerInfo>();
    if (userIds.length === 0) return out;

    const walletRows = await this.walletsRepo.find({
      where: { userId: In(userIds) },
      select: ['userId', 'walletAddress'],
    });

    const addresses = new Set<string>();
    const userByAddress = new Map<string, string>();
    for (const w of walletRows) {
      const addr = w.walletAddress.trim().toLowerCase();
      if (!addr) continue;
      addresses.add(addr);
      if (!userByAddress.has(addr)) userByAddress.set(addr, w.userId);
    }
    for (const u of users) {
      const legacy = u.walletAddress?.trim().toLowerCase();
      if (!legacy) continue;
      addresses.add(legacy);
      if (!userByAddress.has(legacy)) userByAddress.set(legacy, u.id);
    }

    if (addresses.size === 0) return out;

    const partners = await this.partnersRepo
      .createQueryBuilder('mp')
      .where('LOWER(mp.wallet_address) IN (:...addrs)', {
        addrs: [...addresses],
      })
      .getMany();

    // Prefer active partner when multiple wallets match (rare).
    for (const p of partners) {
      const addr = p.walletAddress.trim().toLowerCase();
      const uid = userByAddress.get(addr);
      if (!uid) continue;
      const existing = out.get(uid);
      if (existing?.isActive && !p.isActive) continue;
      out.set(uid, {
        id: p.id,
        displayName: p.displayName,
        walletAddress: p.walletAddress,
        isActive: p.isActive,
      });
    }
    return out;
  }

  private async custodyCardCountsByUserIds(
    userIds: string[],
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (userIds.length === 0) return out;
    const rows = await this.vaultCyclesRepo
      .createQueryBuilder('c')
      .select('c.deposited_by_user_id', 'userId')
      .addSelect('COUNT(*)::int', 'cnt')
      .where('c.deposited_by_user_id IN (:...userIds)', { userIds })
      .andWhere("c.status = 'minted'")
      .groupBy('c.deposited_by_user_id')
      .getRawMany<{ userId: string; cnt: number }>();
    for (const row of rows) {
      if (row.userId) out.set(row.userId, row.cnt);
    }
    return out;
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

/** Display-only short id: U- + first 5 hex of UUID (no dashes). */
export function adminUserShortId(userId: string): string {
  const hex = userId.replace(/-/g, '').slice(0, 5).toUpperCase();
  return `U-${hex}`;
}
