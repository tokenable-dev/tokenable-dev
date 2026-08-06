import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString, Matches } from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  CHAIN_ID_HEADER,
  ChainConfigService,
} from '../../blockchain/chain-config.service';
import type { User } from '../../user/entities/user.entity';
import { UserService } from '../../user/user.service';
import { VaultService } from '../../vault/vault.service';
import { MarketplaceAdminService } from '../admin/marketplace-admin.service';
import {
  SelfVaultSettlement,
  type SelfVaultSettlementStatus,
} from '../entities/self-vault-settlement.entity';
import { MarketplacePartnersService } from '../partners/marketplace-partners.service';
import {
  formatPartnerVaultLabel,
  PSA_VAULT_LABEL,
} from '../partners/partner-vault-label.util';
import { SelfVaultSettlementService } from './self-vault-settlement.service';

class RecordPayoutDto {
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/)
  payoutTxHash!: string;
}

class VaultInfoBatchDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  tokenIds!: string[];
}

@ApiTags('marketplace')
@Controller('marketplace')
export class SelfVaultSettlementController {
  constructor(
    private readonly settlements: SelfVaultSettlementService,
    private readonly users: UserService,
    private readonly vault: VaultService,
    private readonly chainConfig: ChainConfigService,
    private readonly admin: MarketplaceAdminService,
    private readonly partners: MarketplacePartnersService,
  ) {}

  @Get('rwa-tokens/:tokenId/settlement-policy')
  async getSettlementPolicy(@Param('tokenId') tokenId: string) {
    const tid = String(tokenId ?? '').trim();
    if (!/^\d+$/.test(tid)) {
      throw new BadRequestException('tokenId must be a non-negative integer');
    }
    const tokenContract = this.chainConfig.getRwaAddress(
      this.chainConfig.getDefaultChainId(),
    );
    const rows = await this.vault.getVaultCustodyRows(tokenContract, [tid]);
    const row = rows[0];
    const settlementPolicy = row?.settlementPolicy ?? 'standard';
    let vaultLabel = PSA_VAULT_LABEL;
    if (settlementPolicy === 'self_vault_hold') {
      const names = await this.partners.getDisplayNamesByIds(
        row?.vaultPartnerId ? [row.vaultPartnerId] : [],
      );
      vaultLabel = formatPartnerVaultLabel(
        row?.vaultPartnerId ? names.get(row.vaultPartnerId) : null,
      );
    }
    return { tokenId: tid, settlementPolicy, vaultLabel };
  }

  @Post('rwa-tokens/vault-info/batch')
  async batchVaultInfo(@Body() body: VaultInfoBatchDto) {
    const tokenContract = this.chainConfig.getRwaAddress(
      this.chainConfig.getDefaultChainId(),
    );
    const rows = await this.vault.getVaultCustodyRows(
      tokenContract,
      body.tokenIds ?? [],
    );
    const partnerIds = rows
      .map((r) => r.vaultPartnerId)
      .filter((id): id is string => Boolean(id));
    const names = await this.partners.getDisplayNamesByIds(partnerIds);
    return {
      items: rows.map((r) => ({
        tokenId: r.tokenId,
        settlementPolicy: r.settlementPolicy,
        vaultLabel:
          r.settlementPolicy === 'self_vault_hold'
            ? formatPartnerVaultLabel(
                r.vaultPartnerId ? names.get(r.vaultPartnerId) : null,
              )
            : PSA_VAULT_LABEL,
      })),
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('self-vault-settlements/mine')
  async listMine(@Req() req: Request & { user: User }) {
    const wallets = await this.users.listWalletsForUser(req.user.id);
    const seen = new Set<string>();
    const items: SelfVaultSettlement[] = [];
    for (const w of wallets) {
      const addr = w.walletAddress.trim().toLowerCase();
      if (!addr || seen.has(addr)) continue;
      seen.add(addr);
      items.push(...(await this.settlements.listForWallet(addr)));
    }
    items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return { items: items.slice(0, 100) };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('self-vault-settlements/:id/confirm')
  async confirm(
    @Req() req: Request & { user: User },
    @Param('id') id: string,
  ) {
    const wallets = await this.users.listWalletsForUser(req.user.id);
    if (wallets.length === 0) {
      throw new BadRequestException('No linked wallet');
    }
    let lastErr: unknown;
    for (const w of wallets) {
      try {
        return await this.settlements.confirmByBuyer(id, w.walletAddress);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  }

  @Get('admin/self-vault-settlements')
  async adminList(
    @Req() req: Request,
    @Query('status') status?: SelfVaultSettlementStatus,
  ) {
    this.admin.assertAdminSession(req);
    const allowed: SelfVaultSettlementStatus[] = [
      'pending_confirm',
      'confirmed',
      'paid',
      'rejected',
    ];
    const statusFilter =
      status && allowed.includes(status) ? status : undefined;
    const chainId = this.chainConfig.resolveChainId(
      req.header(CHAIN_ID_HEADER) ?? undefined,
    );
    const items = await this.settlements.listByStatus(statusFilter, chainId);
    return { items, chainId };
  }

  /** Repair: create ledger rows for fulfilled self-vault asks missing a settlement. */
  @Post('admin/self-vault-settlements/backfill-missing')
  async adminBackfillMissing(@Req() req: Request) {
    this.admin.assertAdminSession(req);
    const chainId = this.chainConfig.resolveChainId(
      req.header(CHAIN_ID_HEADER) ?? undefined,
    );
    return this.settlements.backfillMissingFromFulfilledAsks({ chainId });
  }

  @Post('admin/self-vault-settlements/:id/confirm')
  async adminConfirm(@Req() req: Request, @Param('id') id: string) {
    this.admin.assertAdminSession(req);
    return this.settlements.adminConfirm(id);
  }

  @Post('admin/self-vault-settlements/:id/reject')
  async adminReject(@Req() req: Request, @Param('id') id: string) {
    this.admin.assertAdminSession(req);
    return this.settlements.adminReject(id);
  }

  /** Send seller net USDC from PLATFORM_FEE wallet, then mark paid. */
  @Post('admin/self-vault-settlements/:id/execute-payout')
  async adminExecutePayout(@Req() req: Request, @Param('id') id: string) {
    this.admin.assertAdminSession(req);
    return this.settlements.executePayout(id);
  }

  /** Manual fallback when ops already sent USDC out-of-band. */
  @Post('admin/self-vault-settlements/:id/record-payout')
  async adminRecordPayout(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: RecordPayoutDto,
  ) {
    this.admin.assertAdminSession(req);
    return this.settlements.recordPayout(id, body.payoutTxHash);
  }
}
