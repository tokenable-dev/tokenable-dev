import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getAddress } from 'ethers';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { ParsedAuthProvider, ParsedWalletLink } from '../auth/privy/privy.types';
import type { UpdateProfileDto } from '../auth/dto/update-profile.dto';
import type {
  CreateShippingAddressDto,
  UpdateShippingAddressDto,
} from './dto/shipping-address.dto';
import { UserAuthProvider } from './entities/user-auth-provider.entity';
import { UserKycEvent, type KycStatusValue } from './entities/user-kyc-event.entity';
import {
  UserShippingAddress,
  type ShippingCountry,
} from './entities/user-shipping-address.entity';
import { User } from './entities/user.entity';
import {
  UserWallet,
  type UserWalletKind,
  type UserWalletSource,
} from './entities/user-wallet.entity';
import {
  DEFAULT_EMAIL_NOTIF_PREFS,
  MAX_SHIPPING_ADDRESSES_PER_USER,
  normalizeEmailNotifPrefs,
} from './user-settings.util';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(UserWallet)
    private readonly userWallets: Repository<UserWallet>,
    @InjectRepository(UserAuthProvider)
    private readonly authProviders: Repository<UserAuthProvider>,
    @InjectRepository(UserKycEvent)
    private readonly kycEvents: Repository<UserKycEvent>,
    @InjectRepository(UserShippingAddress)
    private readonly shippingAddresses: Repository<UserShippingAddress>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  async findByKycExternalId(externalId: string): Promise<User | null> {
    const id = externalId?.trim();
    if (!id) return null;
    return this.users.findOne({ where: { kycExternalId: id } });
  }

  async findByIdOrFail(id: string): Promise<User> {
    const u = await this.findById(id);
    if (!u) throw new NotFoundException('User not found');
    return u;
  }

  async findByPrivyId(privyId: string): Promise<User | null> {
    return this.users.findOne({ where: { privyId } });
  }

  async findOrCreateFromPrivy(params: {
    privyId: string;
    email: string;
    name?: string | null;
    pictureUrl?: string | null;
    emailVerified?: boolean;
    googleId?: string | null;
    authProviders?: ParsedAuthProvider[];
    wallets?: ParsedWalletLink[];
    /** @deprecated Prefer wallets */
    walletAddresses?: string[];
  }): Promise<User> {
    const email = params.email.toLowerCase().trim();
    const wallets =
      params.wallets ??
      (params.walletAddresses ?? []).map((address) => ({
        address,
        chainType: 'ethereum',
        walletKind: 'external' as const,
      }));

    const byPrivy = await this.findByPrivyId(params.privyId);
    if (byPrivy) {
      await this.patchPrivyProfileIfNeeded(byPrivy, params);
      await this.syncPrivyIdentity(byPrivy.id, params.authProviders ?? [], wallets);
      byPrivy.lastPrivySyncAt = new Date();
      await this.users.save(byPrivy);
      return (await this.findById(byPrivy.id)) ?? byPrivy;
    }

    const byEmail = await this.findByEmail(email);
    if (byEmail) {
      byEmail.privyId = params.privyId;
      // Same preserve rules as patchPrivyProfileIfNeeded (Settings name/avatar).
      await this.patchPrivyProfileIfNeeded(byEmail, params);
      byEmail.lastPrivySyncAt = new Date();
      await this.users.save(byEmail);
      await this.syncPrivyIdentity(byEmail.id, params.authProviders ?? [], wallets);
      return (await this.findById(byEmail.id)) ?? byEmail;
    }

    const user = this.users.create({
      email,
      privyId: params.privyId,
      googleId: params.googleId ?? null,
      name: params.name ?? null,
      pictureUrl: params.pictureUrl ?? null,
      emailVerified: params.emailVerified ?? true,
      passwordHash: null,
      lastPrivySyncAt: new Date(),
    });
    const saved = await this.users.save(user);
    await this.syncPrivyIdentity(saved.id, params.authProviders ?? [], wallets);
    return (await this.findById(saved.id)) ?? saved;
  }

  private async patchPrivyProfileIfNeeded(
    user: User,
    params: {
      email: string;
      name?: string | null;
      pictureUrl?: string | null;
      emailVerified?: boolean;
      googleId?: string | null;
    },
  ): Promise<void> {
    let dirty = false;
    const email = params.email.toLowerCase().trim();
    if (email && email !== user.email) {
      user.email = email;
      dirty = true;
    }
    // Preserve Settings display name; only fill when empty.
    if (
      params.name != null &&
      params.name !== user.name &&
      !user.name?.trim()
    ) {
      user.name = params.name;
      dirty = true;
    }
    // Preserve Settings avatar upload; only fill when empty.
    if (
      params.pictureUrl != null &&
      params.pictureUrl !== user.pictureUrl &&
      !user.pictureUrl?.trim()
    ) {
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
    if (params.googleId && !user.googleId) {
      user.googleId = params.googleId;
      dirty = true;
    }
    if (dirty) await this.users.save(user);
  }

  /** Sync linked auth providers from Privy profile (soft-unlink removed providers). */
  async syncAuthProviders(
    userId: string,
    providers: ParsedAuthProvider[],
  ): Promise<void> {
    const desiredKeys = new Set<string>();
    for (const row of providers) {
      const providerType = row.providerType.trim();
      const providerSubject = row.providerSubject.trim();
      if (!providerType || !providerSubject) continue;
      desiredKeys.add(`${providerType}:${providerSubject.toLowerCase()}`);

      const existing = await this.authProviders.findOne({
        where: {
          providerType,
          providerSubject,
          unlinkedAt: IsNull(),
        },
      });

      if (existing) {
        if (existing.userId !== userId) continue;
        existing.providerAccountId =
          row.providerAccountId ?? existing.providerAccountId;
        existing.email = row.email?.toLowerCase() ?? existing.email;
        existing.phone = row.phone ?? existing.phone;
        existing.displayName = row.displayName ?? existing.displayName;
        existing.avatarUrl = row.avatarUrl ?? existing.avatarUrl;
        existing.isVerified = row.isVerified;
        existing.metadata = { ...existing.metadata, ...(row.metadata ?? {}) };
        await this.authProviders.save(existing);
        continue;
      }

      const relinked = await this.authProviders.findOne({
        where: { providerType, providerSubject, userId },
        order: { linkedAt: 'DESC' },
      });
      if (relinked) {
        relinked.unlinkedAt = null;
        relinked.providerAccountId = row.providerAccountId ?? relinked.providerAccountId;
        relinked.email = row.email?.toLowerCase() ?? relinked.email;
        relinked.phone = row.phone ?? relinked.phone;
        relinked.displayName = row.displayName ?? relinked.displayName;
        relinked.avatarUrl = row.avatarUrl ?? relinked.avatarUrl;
        relinked.isVerified = row.isVerified;
        relinked.metadata = { ...relinked.metadata, ...(row.metadata ?? {}) };
        relinked.linkedAt = new Date();
        await this.authProviders.save(relinked);
        continue;
      }

      await this.authProviders.save(
        this.authProviders.create({
          userId,
          providerType,
          providerSubject,
          providerAccountId: row.providerAccountId ?? null,
          email: row.email?.toLowerCase() ?? null,
          phone: row.phone ?? null,
          displayName: row.displayName ?? null,
          avatarUrl: row.avatarUrl ?? null,
          isVerified: row.isVerified,
          metadata: row.metadata ?? {},
        }),
      );
    }

    const active = await this.listAuthProvidersForUser(userId);
    const now = new Date();
    for (const row of active) {
      const key = `${row.providerType}:${row.providerSubject.toLowerCase()}`;
      if (desiredKeys.has(key)) continue;
      row.unlinkedAt = now;
      await this.authProviders.save(row);
    }
  }

  /** Mirror Privy-linked Ethereum wallets onto the account with metadata. */
  async syncPrivyWallets(userId: string, wallets: ParsedWalletLink[]): Promise<void> {
    const desired = new Map<string, ParsedWalletLink>();
    for (const raw of wallets) {
      try {
        desired.set(getAddress(raw.address), {
          ...raw,
          address: getAddress(raw.address),
        });
      } catch {
        /* skip malformed addresses */
      }
    }

    const existing = await this.listWalletsForUser(userId);
    const existingByAddress = new Map(
      existing.map((row) => [row.walletAddress.toLowerCase(), row]),
    );

    for (const [address, meta] of desired) {
      const row = existingByAddress.get(address.toLowerCase());
      if (row) {
        await this.patchWalletMetadata(row, meta, 'privy_sync');
        continue;
      }
      try {
        await this.addWalletAddress(userId, address, {
          chainType: meta.chainType,
          walletKind: meta.walletKind,
          walletClient: meta.walletClient ?? null,
          connectorType: meta.connectorType ?? null,
          source: 'privy_sync',
          privyWalletId: meta.providerAccountId ?? null,
        });
      } catch {
        /* ignore duplicate / conflict for shared addresses */
      }
    }

    for (const row of existing) {
      if (desired.has(row.walletAddress)) continue;
      if (row.source !== 'privy_sync') continue;
      try {
        await this.removeWallet(userId, row.walletAddress);
      } catch {
        /* keep row if removal fails */
      }
    }
  }

  async syncPrivyIdentity(
    userId: string,
    providers: ParsedAuthProvider[],
    wallets: ParsedWalletLink[],
  ): Promise<void> {
    await this.syncAuthProviders(userId, providers);
    await this.syncPrivyWallets(userId, wallets);
  }

  async listAuthProvidersForUser(userId: string): Promise<UserAuthProvider[]> {
    return this.authProviders.find({
      where: { userId, unlinkedAt: IsNull() },
      order: { linkedAt: 'ASC' },
    });
  }

  /** Record KYC transition (webhook / admin override) and append audit event. */
  async updateKycStatus(
    userId: string,
    params: {
      status: KycStatusValue;
      provider?: string;
      externalId?: string | null;
      reason?: string | null;
      payload?: Record<string, unknown>;
    },
  ): Promise<User> {
    const user = await this.findByIdOrFail(userId);
    user.kycStatus = params.status;
    const provider = params.provider ?? user.kycProvider ?? 'sumsub';
    user.kycProvider = provider;
    user.kycExternalId = params.externalId ?? user.kycExternalId;
    user.kycRejectionReason =
      params.status === 'rejected'
        ? (params.reason ?? user.kycRejectionReason)
        : null;
    user.kycVerifiedAt =
      params.status === 'approved' ? new Date() : null;

    await this.kycEvents.save(
      this.kycEvents.create({
        userId,
        status: params.status,
        provider,
        externalId: params.externalId ?? null,
        reason: params.reason ?? null,
        payload: params.payload ?? {},
      }),
    );

    return this.users.save(user);
  }

  private async patchWalletMetadata(
    row: UserWallet,
    meta: ParsedWalletLink,
    source: UserWalletSource,
  ): Promise<void> {
    row.chainType = meta.chainType;
    row.walletKind = meta.walletKind;
    row.walletClient = meta.walletClient ?? null;
    row.connectorType = meta.connectorType ?? null;
    row.privyWalletId = meta.providerAccountId ?? row.privyWalletId;
    row.source = source;
    await this.userWallets.save(row);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: email.toLowerCase().trim() } });
  }

  async updatePictureUrl(userId: string, pictureUrl: string): Promise<User> {
    const user = await this.findByIdOrFail(userId);
    const url = pictureUrl.trim();
    if (!url) throw new BadRequestException('Picture URL is required');
    user.pictureUrl = url;
    return this.users.save(user);
  }

  async listWalletsForUser(userId: string): Promise<UserWallet[]> {
    return this.userWallets.find({
      where: { userId },
      order: { isPrimary: 'DESC', linkedAt: 'ASC' },
    });
  }

  async findWalletForUser(
    userId: string,
    address: string,
  ): Promise<UserWallet | null> {
    return this.userWallets.findOne({
      where: { userId, walletAddress: address },
    });
  }

  /** Add a wallet to the user (does not remove existing wallets). */
  async addWalletAddress(
    userId: string,
    address: string,
    meta?: {
      chainType?: string;
      walletKind?: UserWalletKind;
      walletClient?: string | null;
      connectorType?: string | null;
      source?: UserWalletSource;
      privyWalletId?: string | null;
    },
  ): Promise<User> {
    const user = await this.findByIdOrFail(userId);
    const normalized = address;

    const existing = await this.findWalletForUser(userId, normalized);
    if (existing) {
      if (meta) {
        await this.patchWalletMetadata(existing, {
          address: normalized,
          chainType: meta.chainType ?? existing.chainType,
          walletKind: meta.walletKind ?? existing.walletKind,
          walletClient: meta.walletClient,
          connectorType: meta.connectorType,
          providerAccountId: meta.privyWalletId,
        }, meta.source ?? existing.source);
      }
      return user;
    }

    const count = await this.userWallets.count({ where: { userId } });
    const isPrimary = count === 0;

    const row = this.userWallets.create({
      userId,
      walletAddress: normalized,
      isPrimary,
      chainType: meta?.chainType ?? 'ethereum',
      walletKind: meta?.walletKind ?? 'external',
      walletClient: meta?.walletClient ?? null,
      connectorType: meta?.connectorType ?? null,
      source: meta?.source ?? 'admin',
      privyWalletId: meta?.privyWalletId ?? null,
    });
    await this.userWallets.save(row);

    if (isPrimary) {
      user.walletAddress = normalized;
      user.walletLinkedAt = row.linkedAt;
      return this.users.save(user);
    }

    return user;
  }

  async deleteById(id: string): Promise<void> {
    await this.users.delete({ id });
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

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.findByIdOrFail(userId);
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Display name is required');
      user.name = name;
    }
    if (dto.marketingEmailsOptIn !== undefined) {
      user.marketingEmailsOptIn = dto.marketingEmailsOptIn;
    }
    if (dto.emailNotificationsEnabled !== undefined) {
      user.emailNotificationsEnabled = dto.emailNotificationsEnabled;
    }
    if (dto.emailNotifPrefs !== undefined) {
      user.emailNotifPrefs = normalizeEmailNotifPrefs(
        dto.emailNotifPrefs,
        normalizeEmailNotifPrefs(user.emailNotifPrefs),
      );
    }
    if (
      user.emailNotifPrefs == null ||
      typeof user.emailNotifPrefs !== 'object'
    ) {
      user.emailNotifPrefs = { ...DEFAULT_EMAIL_NOTIF_PREFS };
    }
    return this.users.save(user);
  }

  serializeShippingAddress(row: UserShippingAddress) {
    return {
      id: row.id,
      label: row.label,
      name: row.name,
      line1: row.line1,
      line2: row.line2,
      city: row.city,
      region: row.region,
      postal: row.postal,
      country: row.country,
      phone: row.phone,
      isDefault: row.isDefault,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listShippingAddresses(userId: string): Promise<UserShippingAddress[]> {
    return this.shippingAddresses.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
  }

  async createShippingAddress(
    userId: string,
    dto: CreateShippingAddressDto,
  ): Promise<UserShippingAddress> {
    return this.shippingAddresses.manager.transaction(async (manager) => {
      const repo = manager.getRepository(UserShippingAddress);
      const count = await repo.count({ where: { userId } });
      if (count >= MAX_SHIPPING_ADDRESSES_PER_USER) {
        throw new BadRequestException(
          `You can save up to ${MAX_SHIPPING_ADDRESSES_PER_USER} addresses`,
        );
      }
      const makeDefault = dto.isDefault === true || count === 0;
      if (makeDefault) {
        await repo
          .createQueryBuilder()
          .update(UserShippingAddress)
          .set({ isDefault: false })
          .where('user_id = :userId AND is_default = true', { userId })
          .execute();
      }
      const row = repo.create({
        userId,
        label: (dto.label?.trim() || 'Home').slice(0, 64),
        name: dto.name.trim(),
        line1: dto.line1.trim(),
        line2: dto.line2?.trim() ? dto.line2.trim() : null,
        city: dto.city.trim(),
        region: dto.region?.trim() ? dto.region.trim() : null,
        postal: dto.postal.trim(),
        country: dto.country as ShippingCountry,
        phone: dto.phone.trim(),
        isDefault: makeDefault,
      });
      return repo.save(row);
    });
  }

  async updateShippingAddress(
    userId: string,
    addressId: string,
    dto: UpdateShippingAddressDto,
  ): Promise<UserShippingAddress> {
    return this.shippingAddresses.manager.transaction(async (manager) => {
      const repo = manager.getRepository(UserShippingAddress);
      const row = await repo.findOne({
        where: { id: addressId, userId },
      });
      if (!row) throw new NotFoundException('Address not found');

      if (dto.label !== undefined) {
        row.label = (dto.label.trim() || 'Home').slice(0, 64);
      }
      if (dto.name !== undefined) row.name = dto.name.trim();
      if (dto.line1 !== undefined) row.line1 = dto.line1.trim();
      if (dto.line2 !== undefined) {
        row.line2 = dto.line2?.trim() ? dto.line2.trim() : null;
      }
      if (dto.city !== undefined) row.city = dto.city.trim();
      if (dto.region !== undefined) {
        row.region = dto.region?.trim() ? dto.region.trim() : null;
      }
      if (dto.postal !== undefined) row.postal = dto.postal.trim();
      if (dto.country !== undefined) row.country = dto.country;
      if (dto.phone !== undefined) row.phone = dto.phone.trim();

      if (dto.isDefault === true) {
        await repo
          .createQueryBuilder()
          .update(UserShippingAddress)
          .set({ isDefault: false })
          .where('user_id = :userId AND is_default = true', { userId })
          .execute();
        row.isDefault = true;
      }

      return repo.save(row);
    });
  }

  async setDefaultShippingAddress(
    userId: string,
    addressId: string,
  ): Promise<UserShippingAddress> {
    return this.shippingAddresses.manager.transaction(async (manager) => {
      const repo = manager.getRepository(UserShippingAddress);
      const row = await repo.findOne({ where: { id: addressId, userId } });
      if (!row) throw new NotFoundException('Address not found');
      if (row.isDefault) return row;

      await repo
        .createQueryBuilder()
        .update(UserShippingAddress)
        .set({ isDefault: false })
        .where('user_id = :userId AND is_default = true', { userId })
        .execute();

      await repo
        .createQueryBuilder()
        .update(UserShippingAddress)
        .set({ isDefault: true })
        .where('id = :addressId AND user_id = :userId', { addressId, userId })
        .execute();

      const updated = await repo.findOne({ where: { id: addressId, userId } });
      if (!updated) throw new NotFoundException('Address not found');
      return updated;
    });
  }

  async deleteShippingAddress(userId: string, addressId: string): Promise<void> {
    const row = await this.shippingAddresses.findOne({
      where: { id: addressId, userId },
    });
    if (!row) throw new NotFoundException('Address not found');
    const wasDefault = row.isDefault;
    await this.shippingAddresses.remove(row);
    if (!wasDefault) return;
    const next = await this.shippingAddresses.findOne({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
    if (next) {
      next.isDefault = true;
      await this.shippingAddresses.save(next);
    }
  }
}
