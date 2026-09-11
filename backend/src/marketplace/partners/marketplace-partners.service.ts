import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Wallet } from 'ethers';
import { In, Repository } from 'typeorm';
import { UserService } from '../../user/user.service';
import { MarketplacePartnerAddress } from '../entities/marketplace-partner-address.entity';
import { MarketplacePartner } from '../entities/marketplace-partner.entity';
import {
  decryptPartnerPrivateKey,
  encryptPartnerPrivateKey,
} from './partner-wallet-crypto.util';
import { formatPartnerVaultLabel } from './partner-vault-label.util';
import type { UpsertMarketplacePartnerAddressDto } from './dto/marketplace-partner-address.dto';
import type {
  CreateMarketplacePartnerDto,
  UpdateMarketplacePartnerDto,
} from './dto/marketplace-partner.dto';

const ADDR = /^0x[a-fA-F0-9]{40}$/;
const COUNTRIES_REQUIRING_REGION = new Set(['US', 'CA']);

export type MarketplacePartnerPublic = {
  id: string;
  displayName: string;
  walletAddress: string;
  isActive: boolean;
  hasPrivateKey: boolean;
  hasCompanyAddress: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type MarketplacePartnerAddressPublic = {
  id: string;
  partnerId: string;
  companyName: string;
  contactName: string;
  phone: string;
  country: string;
  city: string;
  region: string | null;
  postal: string;
  line1: string;
  line2: string | null;
  residential: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type SelfVaultPartnerEligibility = {
  /** Active partner AND company Origin address on file (Self vault mint). */
  eligible: boolean;
  /** Wallet matches an active marketplace partner (address may still be missing). */
  isPartner: boolean;
  hasCompanyAddress: boolean;
  partnerId: string | null;
  displayName: string | null;
  vaultLabel: string | null;
};

export type PartnerMeSession = {
  isPartner: boolean;
  partnerId: string | null;
  displayName: string | null;
  vaultLabel: string | null;
  hasCompanyAddress: boolean;
  companyAddress: MarketplacePartnerAddressPublic | null;
};

@Injectable()
export class MarketplacePartnersService {
  private readonly logger = new Logger(MarketplacePartnersService.name);

  constructor(
    @InjectRepository(MarketplacePartner)
    private readonly partnerRepo: Repository<MarketplacePartner>,
    @InjectRepository(MarketplacePartnerAddress)
    private readonly addressRepo: Repository<MarketplacePartnerAddress>,
    private readonly users: UserService,
    private readonly config: ConfigService,
  ) {}
  private masterKey(): string {
    const key =
      this.config.get<string>('PARTNER_WALLET_ENCRYPTION_KEY')?.trim() || '';
    if (!key) {
      throw new InternalServerErrorException(
        'PARTNER_WALLET_ENCRYPTION_KEY is not configured',
      );
    }
    return key;
  }

  private hasKeyMaterial(p: MarketplacePartner): boolean {
    return Boolean(p.encryptedPrivateKey?.trim());
  }

  toAddressPublic(a: MarketplacePartnerAddress): MarketplacePartnerAddressPublic {
    return {
      id: a.id,
      partnerId: a.partnerId,
      companyName: a.companyName,
      contactName: a.contactName,
      phone: a.phone,
      country: a.country,
      city: a.city,
      region: a.region,
      postal: a.postal,
      line1: a.line1,
      line2: a.line2,
      residential: a.residential,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }

  async toPublic(p: MarketplacePartner): Promise<MarketplacePartnerPublic> {
    const hasCompanyAddress = await this.addressRepo.exists({
      where: { partnerId: p.id },
    });
    return {
      id: p.id,
      displayName: p.displayName,
      walletAddress: p.walletAddress,
      isActive: p.isActive,
      hasPrivateKey: this.hasKeyMaterial(p),
      hasCompanyAddress,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  async list(): Promise<MarketplacePartnerPublic[]> {
    const rows = await this.partnerRepo.find({
      order: { displayName: 'ASC' },
    });
    if (!rows.length) return [];
    const addressPartnerIds = new Set(
      (
        await this.addressRepo.find({
          select: ['partnerId'],
          where: { partnerId: In(rows.map((r) => r.id)) },
        })
      ).map((a) => a.partnerId),
    );
    return rows.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      walletAddress: p.walletAddress,
      isActive: p.isActive,
      hasPrivateKey: this.hasKeyMaterial(p),
      hasCompanyAddress: addressPartnerIds.has(p.id),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  async getOrThrow(id: string): Promise<MarketplacePartner> {
    const p = await this.partnerRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException(`Partner ${id} not found`);
    return p;
  }

  async getPublicOrThrow(id: string): Promise<MarketplacePartnerPublic> {
    return this.toPublic(await this.getOrThrow(id));
  }

  async findActiveByWallet(
    walletAddress: string,
  ): Promise<MarketplacePartner | null> {
    const wallet = walletAddress.trim().toLowerCase();
    if (!ADDR.test(wallet)) return null;
    return this.partnerRepo.findOne({
      where: { walletAddress: wallet, isActive: true },
    });
  }

  async findAddressByPartnerId(
    partnerId: string,
  ): Promise<MarketplacePartnerAddress | null> {
    return this.addressRepo.findOne({ where: { partnerId } });
  }

  /**
   * Resolve active partner from any wallet linked to the Tokenable user
   * (user_wallets + legacy users.wallet_address).
   */
  async findActivePartnerForUser(
    userId: string,
  ): Promise<MarketplacePartner | null> {
    const wallets = await this.users.listWalletsForUser(userId);
    const user = await this.users.findById(userId);
    const candidates = new Set<string>();
    for (const w of wallets) {
      const a = w.walletAddress?.trim().toLowerCase();
      if (a && ADDR.test(a)) candidates.add(a);
    }
    const legacy = user?.walletAddress?.trim().toLowerCase();
    if (legacy && ADDR.test(legacy)) candidates.add(legacy);
    if (!candidates.size) return null;

    const rows = await this.partnerRepo.find({
      where: { walletAddress: In([...candidates]), isActive: true },
    });
    return rows[0] ?? null;
  }

  async getPartnerMe(userId: string): Promise<PartnerMeSession> {
    const partner = await this.findActivePartnerForUser(userId);
    if (!partner) {
      return {
        isPartner: false,
        partnerId: null,
        displayName: null,
        vaultLabel: null,
        hasCompanyAddress: false,
        companyAddress: null,
      };
    }
    const address = await this.findAddressByPartnerId(partner.id);
    return {
      isPartner: true,
      partnerId: partner.id,
      displayName: partner.displayName,
      vaultLabel: formatPartnerVaultLabel(partner.displayName),
      hasCompanyAddress: Boolean(address),
      companyAddress: address ? this.toAddressPublic(address) : null,
    };
  }

  private assertAddressDto(
    dto: UpsertMarketplacePartnerAddressDto,
  ): {
    companyName: string;
    contactName: string;
    phone: string;
    country: string;
    city: string;
    region: string | null;
    postal: string;
    line1: string;
    line2: string | null;
    residential: boolean;
  } {
    const country = dto.country.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) {
      throw new BadRequestException('country must be ISO 3166-1 alpha-2');
    }
    const regionRaw = dto.region?.trim() ?? '';
    if (COUNTRIES_REQUIRING_REGION.has(country) && !regionRaw) {
      throw new BadRequestException(
        'region (state/province) is required for US and CA origins',
      );
    }
    return {
      companyName: dto.companyName.trim(),
      contactName: dto.contactName.trim(),
      phone: dto.phone.trim(),
      country,
      city: dto.city.trim(),
      region: regionRaw || null,
      postal: dto.postal.trim(),
      line1: dto.line1.trim(),
      line2: dto.line2?.trim() ? dto.line2.trim() : null,
      residential: dto.residential === true,
    };
  }

  async upsertCompanyAddressForPartner(
    partnerId: string,
    dto: UpsertMarketplacePartnerAddressDto,
  ): Promise<MarketplacePartnerAddressPublic> {
    await this.getOrThrow(partnerId);
    const fields = this.assertAddressDto(dto);
    let row = await this.findAddressByPartnerId(partnerId);
    if (!row) {
      row = this.addressRepo.create({ partnerId, ...fields });
    } else {
      Object.assign(row, fields);
    }
    const saved = await this.addressRepo.save(row);
    this.logger.log(`Upserted partner company address partnerId=${partnerId}`);
    return this.toAddressPublic(saved);
  }

  async upsertCompanyAddressForUser(
    userId: string,
    dto: UpsertMarketplacePartnerAddressDto,
  ): Promise<MarketplacePartnerAddressPublic> {
    const partner = await this.findActivePartnerForUser(userId);
    if (!partner) {
      throw new ForbiddenException(
        'Only active marketplace partners can set a company vault address',
      );
    }
    return this.upsertCompanyAddressForPartner(partner.id, dto);
  }

  async getCompanyAddressPublicOrThrow(
    partnerId: string,
  ): Promise<MarketplacePartnerAddressPublic> {
    const row = await this.findAddressByPartnerId(partnerId);
    if (!row) {
      throw new NotFoundException(
        `Partner ${partnerId} has no company address on file`,
      );
    }
    return this.toAddressPublic(row);
  }

  /** Sell-flow / mint gate: active partner + company Origin address. */
  async getSelfVaultEligibility(
    walletAddress: string,
  ): Promise<SelfVaultPartnerEligibility> {
    const partner = await this.findActiveByWallet(walletAddress);
    if (!partner) {
      return {
        eligible: false,
        isPartner: false,
        hasCompanyAddress: false,
        partnerId: null,
        displayName: null,
        vaultLabel: null,
      };
    }
    const address = await this.findAddressByPartnerId(partner.id);
    const hasCompanyAddress = Boolean(address);
    return {
      eligible: hasCompanyAddress,
      isPartner: true,
      hasCompanyAddress,
      partnerId: partner.id,
      displayName: partner.displayName,
      vaultLabel: formatPartnerVaultLabel(partner.displayName),
    };
  }

  /**
   * Hard gate for Self vault mint (`deliveryMode=direct`).
   * Throws structured 403 — do not rely on frontend alone.
   *
   * Prefer {@link assertSelfVaultEligibleForUser} from authenticated mint —
   * wallet-only lookup misses partners whose row is tied to a non-primary
   * linked wallet (same resolution as PartnerGate / GET partner me).
   */
  async assertSelfVaultEligibleForWallet(walletAddress: string): Promise<{
    partnerId: string;
    displayName: string;
    vaultLabel: string;
  }> {
    const eligibility = await this.getSelfVaultEligibility(walletAddress);
    return this.assertEligibilityOrThrow(eligibility);
  }

  /** Authenticated Self vault mint gate — any linked wallet may match the partner row. */
  async assertSelfVaultEligibleForUser(userId: string): Promise<{
    partnerId: string;
    displayName: string;
    vaultLabel: string;
  }> {
    const session = await this.getPartnerMe(userId);
    return this.assertEligibilityOrThrow({
      eligible: session.isPartner && session.hasCompanyAddress,
      isPartner: session.isPartner,
      hasCompanyAddress: session.hasCompanyAddress,
      partnerId: session.partnerId,
      displayName: session.displayName,
      vaultLabel: session.vaultLabel,
    });
  }

  private assertEligibilityOrThrow(eligibility: SelfVaultPartnerEligibility): {
    partnerId: string;
    displayName: string;
    vaultLabel: string;
  } {
    if (!eligibility.isPartner || !eligibility.partnerId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'SELF_VAULT_PARTNER_ONLY',
        message:
          'Self vault is available only to contracted Tokenable partners',
      });
    }
    if (!eligibility.hasCompanyAddress || !eligibility.eligible) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'COMPANY_ADDRESS_REQUIRED',
        message:
          'Self vault requires a company vault address — set it in Settings → Addresses',
      });
    }
    return {
      partnerId: eligibility.partnerId,
      displayName: eligibility.displayName ?? '',
      vaultLabel: eligibility.vaultLabel ?? '',
    };
  }

  async getDisplayNamesByIds(
    ids: string[],
  ): Promise<Map<string, string>> {
    const unique = [...new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean))];
    const out = new Map<string, string>();
    if (!unique.length) return out;
    const rows = await this.partnerRepo.find({
      where: { id: In(unique) },
    });
    for (const r of rows) {
      out.set(r.id, r.displayName);
    }
    return out;
  }

  async create(dto: CreateMarketplacePartnerDto): Promise<MarketplacePartnerPublic> {
    const displayName = dto.displayName.trim();
    const walletAddress = dto.walletAddress.trim().toLowerCase();
    if (!ADDR.test(walletAddress)) {
      throw new BadRequestException('walletAddress must be a valid Ethereum address');
    }

    const pkRaw = dto.privateKey?.trim() ?? '';
    let encrypted: string | null = null;
    if (pkRaw) {
      let derived: string;
      try {
        encrypted = encryptPartnerPrivateKey(pkRaw, this.masterKey());
        const pk = decryptPartnerPrivateKey(encrypted, this.masterKey());
        derived = new Wallet(pk).address.toLowerCase();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new BadRequestException(`Invalid private key: ${msg}`);
      }
      if (derived !== walletAddress) {
        throw new BadRequestException(
          'walletAddress does not match the provided private key',
        );
      }
    }

    const existing = await this.partnerRepo.findOne({
      where: { walletAddress },
    });
    if (existing) {
      throw new BadRequestException(
        `A partner with wallet ${walletAddress} already exists`,
      );
    }

    const saved = await this.partnerRepo.save(
      this.partnerRepo.create({
        displayName,
        walletAddress,
        encryptedPrivateKey: encrypted,
        isActive: dto.isActive !== false,
      }),
    );
    this.logger.log(
      `Created marketplace partner id=${saved.id} wallet=${walletAddress} hasKey=${Boolean(encrypted)}`,
    );
    return await this.toPublic(saved);
  }

  async update(
    id: string,
    dto: UpdateMarketplacePartnerDto,
  ): Promise<MarketplacePartnerPublic> {
    const partner = await this.getOrThrow(id);
    if (dto.displayName !== undefined) {
      partner.displayName = dto.displayName.trim();
    }
    if (dto.isActive !== undefined) {
      partner.isActive = dto.isActive;
    }
    if (dto.privateKey !== undefined && String(dto.privateKey).trim() !== '') {
      try {
        const encrypted = encryptPartnerPrivateKey(
          dto.privateKey,
          this.masterKey(),
        );
        const pk = decryptPartnerPrivateKey(encrypted, this.masterKey());
        const derived = new Wallet(pk).address.toLowerCase();
        if (derived !== partner.walletAddress) {
          throw new BadRequestException(
            'New private key does not match the registered wallet address',
          );
        }
        partner.encryptedPrivateKey = encrypted;
      } catch (e) {
        if (e instanceof BadRequestException) throw e;
        const msg = e instanceof Error ? e.message : String(e);
        throw new BadRequestException(`Invalid private key: ${msg}`);
      }
    }
    const saved = await this.partnerRepo.save(partner);
    return await this.toPublic(saved);
  }

  /** Decrypt entrusted key for server-side mint/list — never log the result. */
  async getDecryptedPrivateKey(partnerId: string): Promise<{
    partner: MarketplacePartner;
    privateKey: string;
  }> {
    const partner = await this.getOrThrow(partnerId);
    if (!partner.isActive) {
      throw new BadRequestException(`Partner ${partnerId} is inactive`);
    }
    if (!this.hasKeyMaterial(partner)) {
      throw new BadRequestException(
        `Partner ${partnerId} has no entrusted private key — add one before bulk mint/list`,
      );
    }
    try {
      const privateKey = decryptPartnerPrivateKey(
        partner.encryptedPrivateKey!,
        this.masterKey(),
      );
      return { partner, privateKey };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Failed to decrypt partner key id=${partnerId}: ${msg}`);
      throw new InternalServerErrorException(
        'Failed to decrypt partner wallet key — check PARTNER_WALLET_ENCRYPTION_KEY',
      );
    }
  }

  /** Map lowercase wallet → display name for active partners. */
  async resolveDisplayNamesByWallets(
    wallets: string[],
  ): Promise<Map<string, string>> {
    const addrs = [
      ...new Set(
        wallets
          .map((w) => String(w ?? '').trim().toLowerCase())
          .filter((w) => ADDR.test(w)),
      ),
    ];
    const out = new Map<string, string>();
    if (!addrs.length) return out;
    const rows = await this.partnerRepo.find({
      where: { walletAddress: In(addrs) },
    });
    for (const r of rows) {
      out.set(r.walletAddress.toLowerCase(), r.displayName);
    }
    return out;
  }
}
