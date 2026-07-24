import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Wallet } from 'ethers';
import { In, Repository } from 'typeorm';
import { MarketplacePartner } from '../entities/marketplace-partner.entity';
import {
  decryptPartnerPrivateKey,
  encryptPartnerPrivateKey,
} from './partner-wallet-crypto.util';
import type {
  CreateMarketplacePartnerDto,
  UpdateMarketplacePartnerDto,
} from './dto/marketplace-partner.dto';

const ADDR = /^0x[a-fA-F0-9]{40}$/;

export type MarketplacePartnerPublic = {
  id: string;
  displayName: string;
  walletAddress: string;
  isActive: boolean;
  hasPrivateKey: true;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class MarketplacePartnersService {
  private readonly logger = new Logger(MarketplacePartnersService.name);

  constructor(
    @InjectRepository(MarketplacePartner)
    private readonly partnerRepo: Repository<MarketplacePartner>,
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

  toPublic(p: MarketplacePartner): MarketplacePartnerPublic {
    return {
      id: p.id,
      displayName: p.displayName,
      walletAddress: p.walletAddress,
      isActive: p.isActive,
      hasPrivateKey: true,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  async list(): Promise<MarketplacePartnerPublic[]> {
    const rows = await this.partnerRepo.find({
      order: { displayName: 'ASC' },
    });
    return rows.map((p) => this.toPublic(p));
  }

  async getOrThrow(id: string): Promise<MarketplacePartner> {
    const p = await this.partnerRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException(`Partner ${id} not found`);
    return p;
  }

  async getPublicOrThrow(id: string): Promise<MarketplacePartnerPublic> {
    return this.toPublic(await this.getOrThrow(id));
  }

  async create(dto: CreateMarketplacePartnerDto): Promise<MarketplacePartnerPublic> {
    const displayName = dto.displayName.trim();
    const walletAddress = dto.walletAddress.trim().toLowerCase();
    if (!ADDR.test(walletAddress)) {
      throw new BadRequestException('walletAddress must be a valid Ethereum address');
    }

    let encrypted: string;
    let derived: string;
    try {
      encrypted = encryptPartnerPrivateKey(dto.privateKey, this.masterKey());
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
      `Created marketplace partner id=${saved.id} wallet=${walletAddress}`,
    );
    return this.toPublic(saved);
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
    if (dto.privateKey !== undefined) {
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
    return this.toPublic(saved);
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
    try {
      const privateKey = decryptPartnerPrivateKey(
        partner.encryptedPrivateKey,
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
