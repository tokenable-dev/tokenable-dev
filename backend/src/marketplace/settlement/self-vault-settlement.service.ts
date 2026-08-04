import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { SupportedChainId } from '../../blockchain/chain-config.service';
import { Order } from '../entities/order.entity';
import {
  SelfVaultSettlement,
  type SelfVaultSettlementStatus,
} from '../entities/self-vault-settlement.entity';

@Injectable()
export class SelfVaultSettlementService {
  private readonly logger = new Logger(SelfVaultSettlementService.name);

  constructor(
    @InjectRepository(SelfVaultSettlement)
    private readonly repo: Repository<SelfVaultSettlement>,
    private readonly config: ConfigService,
  ) {}

  private platformFeeBps(): number {
    const raw = Number(this.config.get<string>('PLATFORM_FEE_BPS') ?? '500');
    if (!Number.isFinite(raw) || raw < 0) return 500;
    return Math.min(Math.floor(raw), 10_000);
  }

  /** Seller net after the normal platform fee (held until confirm/payout). */
  computeSellerPayoutMicros(grossMicros: string): string {
    const gross = BigInt(grossMicros);
    const feeBps = BigInt(this.platformFeeBps());
    const fee = (gross * feeBps) / BigInt(10_000);
    return String(gross - fee);
  }

  async createFromFulfilledAsk(params: {
    ask: Order;
    buyerWallet: string;
    chainId: SupportedChainId;
    fulfillTxHash?: string | null;
  }): Promise<SelfVaultSettlement | null> {
    const orderHash = params.ask.orderHash?.trim();
    if (!orderHash) return null;

    const existing = await this.repo.findOne({ where: { orderHash } });
    if (existing) return existing;

    const gross = String(
      params.ask.parameters?._settlementAmount ??
        params.ask.considerationAmount ??
        '0',
    ).trim();
    if (!/^\d+$/.test(gross) || BigInt(gross) <= BigInt(0)) {
      this.logger.warn(
        `self_vault_settlement skip: invalid gross for ${orderHash}`,
      );
      return null;
    }

    const row = this.repo.create({
      orderHash,
      tokenContract: params.ask.tokenContract.toLowerCase(),
      tokenId: String(params.ask.tokenId),
      sellerWallet: params.ask.offerer.toLowerCase(),
      buyerWallet: params.buyerWallet.trim().toLowerCase(),
      grossUsdc: gross,
      sellerPayoutUsdc: this.computeSellerPayoutMicros(gross),
      chainId: params.chainId,
      status: 'pending_confirm',
      fulfillTxHash: params.fulfillTxHash?.trim() || null,
      payoutTxHash: null,
      confirmedAt: null,
      paidAt: null,
    });

    try {
      return await this.repo.save(row);
    } catch (e) {
      const again = await this.repo.findOne({ where: { orderHash } });
      if (again) return again;
      throw e;
    }
  }

  async listForWallet(wallet: string): Promise<SelfVaultSettlement[]> {
    const w = wallet.trim().toLowerCase();
    return this.repo.find({
      where: [{ sellerWallet: w }, { buyerWallet: w }],
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async listByStatus(
    status?: SelfVaultSettlementStatus,
  ): Promise<SelfVaultSettlement[]> {
    return this.repo.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async confirmByBuyer(
    id: string,
    buyerWallet: string,
  ): Promise<SelfVaultSettlement> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Settlement not found');
    if (row.buyerWallet !== buyerWallet.trim().toLowerCase()) {
      throw new ForbiddenException('Only the buyer can confirm this settlement');
    }
    if (row.status === 'paid' || row.status === 'rejected') {
      throw new BadRequestException(`Settlement is already ${row.status}`);
    }
    if (row.status === 'confirmed') return row;
    row.status = 'confirmed';
    row.confirmedAt = new Date();
    return this.repo.save(row);
  }

  /** Ops shortcut: mark confirmed without buyer action. */
  async adminConfirm(id: string): Promise<SelfVaultSettlement> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Settlement not found');
    if (row.status === 'paid' || row.status === 'rejected') {
      throw new BadRequestException(`Settlement is already ${row.status}`);
    }
    if (row.status !== 'confirmed') {
      row.status = 'confirmed';
      row.confirmedAt = new Date();
    }
    return this.repo.save(row);
  }

  async adminReject(id: string): Promise<SelfVaultSettlement> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Settlement not found');
    if (row.status === 'paid') {
      throw new BadRequestException('Settlement is already paid');
    }
    row.status = 'rejected';
    return this.repo.save(row);
  }

  /**
   * Record company-wallet USDC transfer to seller (tx executed out-of-band or by ops).
   */
  async recordPayout(
    id: string,
    payoutTxHash: string,
  ): Promise<SelfVaultSettlement> {
    const tx = payoutTxHash.trim();
    if (!/^0x[a-fA-F0-9]{64}$/.test(tx)) {
      throw new BadRequestException('payoutTxHash must be a 0x-prefixed tx hash');
    }
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Settlement not found');
    if (row.status === 'rejected') {
      throw new BadRequestException('Settlement was rejected');
    }
    if (row.status === 'pending_confirm') {
      throw new BadRequestException(
        'Settlement must be confirmed before payout',
      );
    }
    row.status = 'paid';
    row.payoutTxHash = tx;
    row.paidAt = new Date();
    return this.repo.save(row);
  }
}
