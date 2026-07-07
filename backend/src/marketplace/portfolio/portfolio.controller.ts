import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { apiBodyDefault } from '../../swagger/api-body.util';
import { SWAGGER_BODY_EXAMPLES } from '../../swagger/examples';
import { SWAGGER_FIXTURES } from '../../swagger/fixtures';
import { PortfolioHideHoldingDto } from './dto/portfolio-hide-holding.dto';
import { PortfolioHoldingsBatchDto } from './dto/portfolio-holdings-batch.dto';
import { PortfolioSetCostBasisDto } from './dto/portfolio-set-cost-basis.dto';
import { PortfolioDailySnapshotService } from './portfolio-daily-snapshot.service';
import { PortfolioHoldingService } from './portfolio-holding.service';

/**
 * 포트폴리오 — 일별 스냅샷·24h P&L·보유 숨김·cost basis.
 */
@ApiTags('marketplace')
@Controller('marketplace')
export class PortfolioController {
  constructor(
    private readonly portfolioSnapshots: PortfolioDailySnapshotService,
    private readonly portfolioHoldings: PortfolioHoldingService,
  ) {}

  /** 지갑 일별 가치 스냅샷 + 최근 24h 손익 */
  @ApiOperation({ summary: '포트폴리오 일별 스냅샷·24h P&L' })
  @ApiParam({ name: 'wallet', description: '지갑 주소', example: SWAGGER_FIXTURES.wallet })
  @ApiQuery({ name: 'limit', required: false, example: 32, description: '조회할 일별 스냅샷 수 (2–120)' })
  @Get('portfolio/daily/:wallet')
  async getPortfolioDailySnapshots(
    @Param('wallet') wallet: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit =
      limitRaw != null && String(limitRaw).trim() !== ''
        ? Math.max(2, Math.min(120, parseInt(String(limitRaw), 10)))
        : 32;
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

  /** 포트폴리오 합계에서 제외한 tokenId 목록 */
  @ApiOperation({ summary: '숨긴 보유 목록' })
  @ApiParam({ name: 'wallet', description: '지갑 주소', example: SWAGGER_FIXTURES.wallet })
  @Get('portfolio/hidden/:wallet')
  async listPortfolioHidden(@Param('wallet') wallet: string) {
    const tokenIds = await this.portfolioHoldings.listHiddenTokenIds(wallet);
    return { tokenIds };
  }

  /** 보유를 포트폴리오 합계·목록에서 숨김 (온체인 보유는 유지) */
  @ApiOperation({ summary: '보유 숨기기' })
  @ApiBody(apiBodyDefault(PortfolioHideHoldingDto, SWAGGER_BODY_EXAMPLES.portfolioHide))
  @Post('portfolio/hidden')
  async hidePortfolioHolding(@Body() body: PortfolioHideHoldingDto) {
    await this.portfolioHoldings.hide(body.walletAddress, body.tokenId);
    return { ok: true };
  }

  /** 숨긴 보유 다시 표시 */
  @ApiOperation({ summary: '보유 숨김 해제' })
  @ApiBody(apiBodyDefault(PortfolioHideHoldingDto, SWAGGER_BODY_EXAMPLES.portfolioHide))
  @Delete('portfolio/hidden')
  async unhidePortfolioHolding(@Body() body: PortfolioHideHoldingDto) {
    await this.portfolioHoldings.unhide(body.walletAddress, body.tokenId);
    return { ok: true };
  }

  @ApiOperation({
    summary: '보유 메타 배치 조회 (숨김·cost basis)',
    description:
      'My Assets P/L용. `costBasisUsd` + `costBasisSource` (vault_delivery, marketplace_buy, manual, …).',
  })
  @ApiBody(
    apiBodyDefault(
      PortfolioHoldingsBatchDto,
      SWAGGER_BODY_EXAMPLES.portfolioHoldingsBatch,
    ),
  )
  @Post('portfolio/holdings/batch')
  async getPortfolioHoldingsBatch(@Body() body: PortfolioHoldingsBatchDto) {
    const items = await this.portfolioHoldings.getHoldingsBatch(
      body.walletAddress,
      body.tokenIds,
    );
    return { items };
  }

  /** User manual cost basis edit — never overwritten by auto seed */
  @ApiOperation({ summary: 'Cost basis 수동 설정' })
  @ApiBody(
    apiBodyDefault(
      PortfolioSetCostBasisDto,
      SWAGGER_BODY_EXAMPLES.portfolioSetCostBasis,
    ),
  )
  @Put('portfolio/holdings/cost-basis')
  async setPortfolioCostBasis(@Body() body: PortfolioSetCostBasisDto) {
    await this.portfolioHoldings.setManualCostBasis(
      body.walletAddress,
      body.tokenId,
      body.costBasisUsd,
    );
    return { ok: true };
  }
}
