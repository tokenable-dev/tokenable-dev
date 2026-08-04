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
import { IsString, Matches } from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ChainConfigService } from '../../blockchain/chain-config.service';
import type { User } from '../../user/entities/user.entity';
import { UserService } from '../../user/user.service';
import { VaultService } from '../../vault/vault.service';
import { MarketplaceAdminService } from '../admin/marketplace-admin.service';
import {
  SelfVaultSettlement,
  type SelfVaultSettlementStatus,
} from '../entities/self-vault-settlement.entity';
import { SelfVaultSettlementService } from './self-vault-settlement.service';

class RecordPayoutDto {
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/)
  payoutTxHash!: string;
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
    const settlementPolicy = await this.vault.getSettlementPolicy(
      tokenContract,
      tid,
    );
    return { tokenId: tid, settlementPolicy };
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
    const items = await this.settlements.listByStatus(status);
    return { items };
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
