import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PortfolioHideHoldingDto } from './dto/portfolio-hide-holding.dto';
import { PortfolioDailySnapshotService } from './portfolio-daily-snapshot.service';
import { PortfolioHiddenHoldingService } from './portfolio-hidden-holding.service';

@ApiTags('marketplace')
@Controller('marketplace')
export class PortfolioController {
  constructor(
    private readonly portfolioSnapshots: PortfolioDailySnapshotService,
    private readonly portfolioHidden: PortfolioHiddenHoldingService,
  ) {}

  @ApiOperation({
    summary:
      'Portfolio daily snapshots (09:00 KST capture) + derived 24h P&L from latest two rows.',
  })
  @ApiParam({ name: 'wallet', description: 'Wallet address' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max rows (default 32, max 120)' })
  @Get('portfolio/daily/:wallet')
  async getPortfolioDailySnapshots(
    @Param('wallet') wallet: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit =
      limitRaw != null && String(limitRaw).trim() !== ''
        ? Math.max(2, Math.min(120, parseInt(String(limitRaw), 10)))
        : 32;
    // Fallback capture runs in background — never block GET on full wallet pricing.
    this.portfolioSnapshots.scheduleCurrentSlotSnapshot(wallet);
    const rows = await this.portfolioSnapshots.listWalletSnapshots(wallet, limit);
    if (rows.length === 0) {
      this.portfolioSnapshots.scheduleBaselineSnapshot(wallet);
    }
    const p = await this.portfolioSnapshots.latest24h(wallet);
    return {
      items: rows.map((r) => ({
        walletAddress: r.walletAddress,
        snapshotDateKst: r.snapshotDateKst,
        snapshotAt: r.snapshotAt.toISOString(),
        totalValueUsd: r.totalValueUsd,
        cardCount: r.cardCount,
      })),
      latest24h: {
        pnlUsd: p.pnl24hUsd,
        pnlPct: p.pnl24hPct,
      },
    };
  }

  @ApiOperation({
    summary:
      'Portfolio hidden holdings — token IDs excluded from portfolio value (off-chain preference; NFT stays in wallet).',
  })
  @ApiParam({ name: 'wallet', description: 'Wallet address' })
  @Get('portfolio/hidden/:wallet')
  async listPortfolioHidden(@Param('wallet') wallet: string) {
    const tokenIds = await this.portfolioHidden.listHiddenTokenIds(wallet);
    return { tokenIds };
  }

  @ApiOperation({ summary: 'Hide a holding from portfolio totals and default holdings view.' })
  @ApiBody({ type: PortfolioHideHoldingDto })
  @Post('portfolio/hidden')
  async hidePortfolioHolding(@Body() body: PortfolioHideHoldingDto) {
    await this.portfolioHidden.hide(body.walletAddress, body.tokenId);
    return { ok: true };
  }

  @ApiOperation({ summary: 'Restore a hidden holding to portfolio totals and holdings view.' })
  @ApiBody({ type: PortfolioHideHoldingDto })
  @Delete('portfolio/hidden')
  async unhidePortfolioHolding(@Body() body: PortfolioHideHoldingDto) {
    await this.portfolioHidden.unhide(body.walletAddress, body.tokenId);
    return { ok: true };
  }
}
