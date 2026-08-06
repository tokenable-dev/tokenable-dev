import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import {
  ChainConfigService,
  type SupportedChainId,
} from '../../blockchain/chain-config.service';
import { PlatformFeeWalletService } from '../../blockchain/platform-fee-wallet.service';
import { Order, OrderSide, OrderStatus } from '../entities/order.entity';
import {
  PortfolioCostBasisSource,
  PortfolioHolding,
} from '../entities/portfolio-holding.entity';
import { RwaToken } from '../entities/rwa-token.entity';
import {
  SelfVaultSettlement,
  type SelfVaultSettlementStatus,
} from '../entities/self-vault-settlement.entity';
import { isSelfVaultHoldPolicy } from './rwa-settlement-policy';

/** Default delay before auto confirm+payout (fulfill → paid). */
export const SELF_VAULT_AUTO_PAYOUT_DELAY_SECONDS_DEFAULT = 300;

@Injectable()
export class SelfVaultSettlementService {
  private readonly logger = new Logger(SelfVaultSettlementService.name);
  /** Serializes payouts per settlement id (cron + admin race). */
  private readonly payoutLocks = new Map<string, Promise<unknown>>();

  constructor(
    @InjectRepository(SelfVaultSettlement)
    private readonly repo: Repository<SelfVaultSettlement>,
    @InjectRepository(Order)
    private readonly orders: Repository<Order>,
    @InjectRepository(RwaToken)
    private readonly rwaTokens: Repository<RwaToken>,
    @InjectRepository(PortfolioHolding)
    private readonly holdings: Repository<PortfolioHolding>,
    private readonly config: ConfigService,
    private readonly chainConfig: ChainConfigService,
    private readonly platformFeeWallet: PlatformFeeWalletService,
  ) {}

  private platformFeeBps(): number {
    const raw = Number(this.config.get<string>('PLATFORM_FEE_BPS') ?? '500');
    if (!Number.isFinite(raw) || raw < 0) return 500;
    return Math.min(Math.floor(raw), 10_000);
  }

  /** Seconds after fulfill (`created_at`) before cron auto-pays. */
  autoPayoutDelaySeconds(): number {
    const raw = Number(
      this.config.get<string>('SELF_VAULT_AUTO_PAYOUT_DELAY_SECONDS') ??
        String(SELF_VAULT_AUTO_PAYOUT_DELAY_SECONDS_DEFAULT),
    );
    if (!Number.isFinite(raw) || raw < 0) {
      return SELF_VAULT_AUTO_PAYOUT_DELAY_SECONDS_DEFAULT;
    }
    return Math.floor(raw);
  }

  private withPayoutLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.payoutLocks.get(id) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    this.payoutLocks.set(
      id,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
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
    chainId?: SupportedChainId,
  ): Promise<SelfVaultSettlement[]> {
    return this.repo.find({
      where: {
        ...(status ? { status } : {}),
        ...(chainId != null ? { chainId } : {}),
      },
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
    if (row.status === 'paid') return row;
    row.status = 'paid';
    row.payoutTxHash = tx;
    row.paidAt = new Date();
    return this.repo.save(row);
  }

  /**
   * Send seller_payout_usdc from PLATFORM_FEE wallet, then mark paid.
   * Accepts `pending_confirm` (auto-confirms) or `confirmed`.
   * Requires PLATFORM_FEE_PRIVATE_KEY matching PLATFORM_FEE_RECIPIENT.
   */
  async executePayout(id: string): Promise<SelfVaultSettlement> {
    return this.withPayoutLock(id, async () => {
      const row = await this.repo.findOne({ where: { id } });
      if (!row) throw new NotFoundException('Settlement not found');
      if (row.status === 'paid') return row;
      if (row.status === 'rejected') {
        throw new BadRequestException('Settlement was rejected');
      }
      if (
        row.status !== 'pending_confirm' &&
        row.status !== 'confirmed'
      ) {
        throw new BadRequestException(
          `Settlement cannot be paid from status ${row.status}`,
        );
      }
      if (!this.platformFeeWallet.isConfigured()) {
        throw new BadRequestException(
          'PLATFORM_FEE_PRIVATE_KEY is not configured — set it in backend .env (must match PLATFORM_FEE_RECIPIENT)',
        );
      }

      if (row.status === 'pending_confirm') {
        row.status = 'confirmed';
        row.confirmedAt = new Date();
        await this.repo.save(row);
      }

      const { txHash } = await this.platformFeeWallet.transferUsdc({
        to: row.sellerWallet,
        amountMicros: row.sellerPayoutUsdc,
        chainId: row.chainId as SupportedChainId,
      });

      row.status = 'paid';
      row.payoutTxHash = txHash;
      row.paidAt = new Date();
      return this.repo.save(row);
    });
  }

  /**
   * Auto confirm + payout for settlements older than the delay since fulfill.
   * Disabled when SELF_VAULT_AUTO_PAYOUT_CRON=0 or fee wallet key missing.
   */
  @Cron('*/1 * * * *')
  async autoPayoutCron(): Promise<void> {
    if (this.config.get<string>('SELF_VAULT_AUTO_PAYOUT_CRON') === '0') return;
    if (!this.platformFeeWallet.isConfigured()) return;

    const delayMs = this.autoPayoutDelaySeconds() * 1000;
    const dueBefore = new Date(Date.now() - delayMs);
    const due = await this.repo.find({
      where: {
        status: In(['pending_confirm', 'confirmed']),
        createdAt: LessThanOrEqual(dueBefore),
      },
      order: { createdAt: 'ASC' },
      take: 20,
    });

    for (const row of due) {
      try {
        await this.executePayout(row.id);
        this.logger.log(
          `Self-vault auto-payout ok ${row.id} token #${row.tokenId}`,
        );
      } catch (err) {
        this.logger.error(
          `Self-vault auto-payout failed ${row.id}: ${String(err)}`,
        );
      }
    }
  }

  /**
   * Repair path: create ledger rows for fulfilled self_vault_hold asks that
   * never got a settlement (e.g. table missing at fulfill time).
   */
  async backfillMissingFromFulfilledAsks(params?: {
    chainId?: SupportedChainId;
  }): Promise<{ created: number; skipped: number; items: SelfVaultSettlement[] }> {
    const asks = await this.orders.find({
      where: { side: OrderSide.ASK, status: OrderStatus.FULFILLED },
      order: { updatedAt: 'DESC' },
      take: 500,
    });

    let created = 0;
    let skipped = 0;
    const items: SelfVaultSettlement[] = [];

    for (const ask of asks) {
      const existing = await this.repo.findOne({
        where: { orderHash: ask.orderHash },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      const token = await this.rwaTokens.findOne({
        where: {
          tokenContract: ask.tokenContract.toLowerCase(),
          tokenId: String(ask.tokenId),
        },
      });
      if (!isSelfVaultHoldPolicy(token?.settlementPolicy)) {
        skipped += 1;
        continue;
      }

      const chainId =
        this.chainConfig.resolveChainIdFromRwaAddress(ask.tokenContract) ??
        params?.chainId ??
        this.chainConfig.getDefaultChainId();
      if (params?.chainId != null && chainId !== params.chainId) {
        skipped += 1;
        continue;
      }

      const tid = Math.floor(Number(ask.tokenId));
      let buyerWallet = '';
      if (Number.isFinite(tid) && tid >= 0) {
        const holding = await this.holdings.findOne({
          where: {
            tokenContract: ask.tokenContract.toLowerCase(),
            tokenId: tid,
            costBasisSource: PortfolioCostBasisSource.MARKETPLACE_BUY,
          },
          order: { acquiredAt: 'DESC', updatedAt: 'DESC' },
        });
        buyerWallet = holding?.walletAddress?.trim().toLowerCase() ?? '';
      }
      if (!buyerWallet) {
        this.logger.warn(
          `backfill skip ask ${ask.orderHash.slice(0, 10)}… token #${ask.tokenId}: no marketplace_buy holding for buyer`,
        );
        skipped += 1;
        continue;
      }

      const row = await this.createFromFulfilledAsk({
        ask,
        buyerWallet,
        chainId,
      });
      if (row) {
        created += 1;
        items.push(row);
      } else {
        skipped += 1;
      }
    }

    return { created, skipped, items };
  }
}
