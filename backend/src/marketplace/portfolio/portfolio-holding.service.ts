import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { RwaToken } from '../entities/rwa-token.entity';
import { ChainConfigService, type SupportedChainId } from '../../blockchain/chain-config.service';
import {
  PortfolioCostBasisSource,
  PortfolioHolding,
} from '../entities/portfolio-holding.entity';

export type PortfolioHoldingBatchItem = {
  tokenId: number;
  hidden: boolean;
  costBasisUsd: number | null;
  costBasisSource: PortfolioCostBasisSource | null;
  acquiredAt: string | null;
};

@Injectable()
export class PortfolioHoldingService {
  constructor(
    @InjectRepository(PortfolioHolding)
    private readonly holdingRepo: Repository<PortfolioHolding>,
    @InjectRepository(RwaToken)
    private readonly rwaTokens: Repository<RwaToken>,
    private readonly chainConfig: ChainConfigService,
  ) {}

  private normalizeWallet(walletAddress: string): string {
    return walletAddress.trim().toLowerCase();
  }

  private rwaContractAddress(chainId?: SupportedChainId): string {
    return this.chainConfig.getRwaAddress(
      chainId ?? this.chainConfig.getDefaultChainId(),
    );
  }

  private normalizeTokenId(tokenId: number): number {
    return Math.max(0, Math.floor(Number(tokenId)));
  }

  async listHiddenTokenIds(
    walletAddress: string,
    chainId?: SupportedChainId,
  ): Promise<number[]> {
    const wallet = this.normalizeWallet(walletAddress);
    if (!wallet) return [];
    const rows = await this.holdingRepo.find({
      where: {
        walletAddress: wallet,
        tokenContract: this.rwaContractAddress(chainId),
        hiddenAt: Not(IsNull()),
      },
      order: { hiddenAt: 'DESC' },
    });
    return rows.map((r) => r.tokenId);
  }

  async hide(
    walletAddress: string,
    tokenId: number,
    chainId?: SupportedChainId,
  ): Promise<void> {
    const wallet = this.normalizeWallet(walletAddress);
    if (!wallet) return;
    const tid = this.normalizeTokenId(tokenId);
    const contract = this.rwaContractAddress(chainId);
    const existing = await this.holdingRepo.findOne({
      where: { walletAddress: wallet, tokenContract: contract, tokenId: tid },
    });
    if (existing) {
      existing.hiddenAt = new Date();
      await this.holdingRepo.save(existing);
      return;
    }
    await this.holdingRepo.save(
      this.holdingRepo.create({
        walletAddress: wallet,
        tokenContract: contract,
        tokenId: tid,
        hiddenAt: new Date(),
      }),
    );
  }

  async unhide(
    walletAddress: string,
    tokenId: number,
    chainId?: SupportedChainId,
  ): Promise<void> {
    const wallet = this.normalizeWallet(walletAddress);
    if (!wallet) return;
    const tid = this.normalizeTokenId(tokenId);
    const contract = this.rwaContractAddress(chainId);
    const existing = await this.holdingRepo.findOne({
      where: { walletAddress: wallet, tokenContract: contract, tokenId: tid },
    });
    if (!existing) return;
    if (
      existing.costBasisUsd == null &&
      existing.costBasisSource == null &&
      existing.acquiredAt == null
    ) {
      await this.holdingRepo.delete(existing.id);
      return;
    }
    existing.hiddenAt = null;
    await this.holdingRepo.save(existing);
  }

  async filterVisibleTokenIds(
    walletAddress: string,
    tokenIds: number[],
    chainId?: SupportedChainId,
  ): Promise<number[]> {
    const wallet = this.normalizeWallet(walletAddress);
    if (!wallet || tokenIds.length === 0) return tokenIds;
    const hidden = new Set(await this.listHiddenTokenIds(wallet, chainId));
    if (hidden.size === 0) return tokenIds;
    return tokenIds.filter((id) => !hidden.has(id));
  }

  async getHoldingsBatch(
    walletAddress: string,
    tokenIds: number[],
    chainId?: SupportedChainId,
  ): Promise<PortfolioHoldingBatchItem[]> {
    const wallet = this.normalizeWallet(walletAddress);
    if (!wallet || tokenIds.length === 0) return [];
    const contract = this.rwaContractAddress(chainId);
    const normalized = [
      ...new Set(
        tokenIds
          .map((id) => this.normalizeTokenId(id))
          .filter((id) => Number.isFinite(id)),
      ),
    ];
    if (normalized.length === 0) return [];

    const rows = await this.holdingRepo.find({
      where: {
        walletAddress: wallet,
        tokenContract: contract,
        tokenId: In(normalized),
      },
    });
    const byTokenId = new Map(rows.map((r) => [r.tokenId, r]));

    const missingAcquired = normalized.filter(
      (id) => !byTokenId.get(id)?.acquiredAt,
    );
    const mintedAtByToken = new Map<number, Date>();
    if (missingAcquired.length > 0) {
      const registry = await this.rwaTokens.find({
        where: {
          tokenContract: contract,
          tokenId: In(missingAcquired.map(String)),
        },
        select: ['tokenId', 'createdAt'],
      });
      for (const row of registry) {
        const tid = Number(row.tokenId);
        if (Number.isFinite(tid) && row.createdAt) {
          mintedAtByToken.set(tid, row.createdAt);
        }
      }
    }

    return normalized.map((tokenId) => {
      const row = byTokenId.get(tokenId);
      const acquiredAt =
        row?.acquiredAt?.toISOString() ??
        mintedAtByToken.get(tokenId)?.toISOString() ??
        null;
      return {
        tokenId,
        hidden: row?.hiddenAt != null,
        costBasisUsd: row?.costBasisUsd ?? null,
        costBasisSource: row?.costBasisSource ?? null,
        acquiredAt,
      };
    });
  }

  /**
   * Direct/self-vault mint: always record acquiredAt so Tx History shows MINT
   * even when Cardhedger has no mark USD for cost basis.
   */
  async recordVaultMintAcquisition(
    walletAddress: string,
    tokenId: number,
    acquiredAt = new Date(),
    chainId?: SupportedChainId,
  ): Promise<void> {
    const wallet = this.normalizeWallet(walletAddress);
    if (!wallet) return;
    const tid = this.normalizeTokenId(tokenId);
    const contract = this.rwaContractAddress(chainId);
    const existing = await this.holdingRepo.findOne({
      where: { walletAddress: wallet, tokenContract: contract, tokenId: tid },
    });
    if (existing) {
      if (!existing.acquiredAt) {
        existing.acquiredAt = acquiredAt;
        await this.holdingRepo.save(existing);
      }
      return;
    }
    await this.holdingRepo.save(
      this.holdingRepo.create({
        walletAddress: wallet,
        tokenContract: contract,
        tokenId: tid,
        acquiredAt,
      }),
    );
  }

  async setManualCostBasis(
    walletAddress: string,
    tokenId: number,
    costBasisUsd: number,
    chainId?: SupportedChainId,
  ): Promise<void> {
    const wallet = this.normalizeWallet(walletAddress);
    if (!wallet) return;
    const tid = this.normalizeTokenId(tokenId);
    const usd = Number(costBasisUsd);
    if (!Number.isFinite(usd) || usd < 0) {
      throw new BadRequestException('Invalid cost basis');
    }
    const contract = this.rwaContractAddress(chainId);
    const now = new Date();
    const existing = await this.holdingRepo.findOne({
      where: { walletAddress: wallet, tokenContract: contract, tokenId: tid },
    });
    if (existing) {
      existing.costBasisUsd = usd;
      existing.costBasisSource = PortfolioCostBasisSource.MANUAL;
      existing.acquiredAt = existing.acquiredAt ?? now;
      await this.holdingRepo.save(existing);
      return;
    }
    await this.holdingRepo.save(
      this.holdingRepo.create({
        walletAddress: wallet,
        tokenContract: contract,
        tokenId: tid,
        costBasisUsd: usd,
        costBasisSource: PortfolioCostBasisSource.MANUAL,
        acquiredAt: now,
      }),
    );
  }

  /**
   * Seeds cost basis from an auto source. Never overwrites manual edits.
   */
  private async seedAutoCostBasis(
    walletAddress: string,
    tokenId: number,
    costBasisUsd: number,
    source:
      | PortfolioCostBasisSource.VAULT_DELIVERY
      | PortfolioCostBasisSource.MARKETPLACE_BUY,
    acquiredAt: Date,
    chainId?: SupportedChainId,
  ): Promise<void> {
    const wallet = this.normalizeWallet(walletAddress);
    if (!wallet) return;
    const tid = this.normalizeTokenId(tokenId);
    const usd = Number(costBasisUsd);
    if (!Number.isFinite(usd) || usd < 0) return;

    const contract = this.rwaContractAddress(chainId);
    const existing = await this.holdingRepo.findOne({
      where: { walletAddress: wallet, tokenContract: contract, tokenId: tid },
    });
    if (existing?.costBasisSource === PortfolioCostBasisSource.MANUAL) {
      return;
    }

    if (existing) {
      existing.costBasisUsd = usd;
      existing.costBasisSource = source;
      existing.acquiredAt = acquiredAt;
      await this.holdingRepo.save(existing);
      return;
    }

    await this.holdingRepo.save(
      this.holdingRepo.create({
        walletAddress: wallet,
        tokenContract: contract,
        tokenId: tid,
        costBasisUsd: usd,
        costBasisSource: source,
        acquiredAt,
      }),
    );
  }

  /**
   * Seeds cost basis at vault deliver time from market mark USD.
   * Never overwrites a user manual edit.
   */
  async seedVaultDeliveryCostBasis(
    walletAddress: string,
    tokenId: number,
    costBasisUsd: number,
    acquiredAt = new Date(),
    chainId?: SupportedChainId,
  ): Promise<void> {
    return this.seedAutoCostBasis(
      walletAddress,
      tokenId,
      costBasisUsd,
      PortfolioCostBasisSource.VAULT_DELIVERY,
      acquiredAt,
      chainId,
    );
  }

  /**
   * Seeds cost basis when a buyer fulfills a marketplace ask (or matched pair).
   * Uses the USDC fill price. Never overwrites a user manual edit.
   */
  async seedMarketplaceBuyCostBasis(
    walletAddress: string,
    tokenId: number,
    costBasisUsd: number,
    acquiredAt = new Date(),
    chainId?: SupportedChainId,
  ): Promise<void> {
    return this.seedAutoCostBasis(
      walletAddress,
      tokenId,
      costBasisUsd,
      PortfolioCostBasisSource.MARKETPLACE_BUY,
      acquiredAt,
      chainId,
    );
  }
}
