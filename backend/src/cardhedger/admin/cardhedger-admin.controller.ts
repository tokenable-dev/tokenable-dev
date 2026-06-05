import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { MarketplaceAdminService } from '../../marketplace/admin/marketplace-admin.service';
import { CardhedgerHealthService } from './cardhedger-health.service';
import { CardhedgerPrometheusService } from './cardhedger-prometheus.service';
import { SWAGGER_FIXTURES } from '../../swagger/fixtures';
import type {
  CardhedgerHealthPayload,
  CircuitHealth,
  ResolveHealth,
  SchedulerHealth,
} from './cardhedger-health.service';

/**
 * Cardhedger 연동 헬스·메트릭 (관리자 지갑 `adminWallet` 쿼리 필수).
 * `GET /api/admin/cardhedger/*`
 */
@ApiTags('admin')
@Controller('admin/cardhedger')
export class CardhedgerAdminController {
  constructor(
    private readonly health: CardhedgerHealthService,
    private readonly prometheus: CardhedgerPrometheusService,
    private readonly adminService: MarketplaceAdminService,
  ) {}

  private assertAdmin(adminWallet: string | undefined): void {
    if (!adminWallet?.trim()) {
      throw new ForbiddenException('adminWallet query parameter is required');
    }
    this.adminService.assertAdminWallet(adminWallet.trim());
  }

  /** Cardhedger 통합 헬스 (서킷·resolve·스케줄러) */
  @Get('health')
  @ApiOperation({ summary: 'Cardhedger 통합 헬스' })
  @ApiQuery({
    name: 'adminWallet',
    required: true,
    example: SWAGGER_FIXTURES.walletAlt,
    description: 'MARKETPLACE_ADMIN_WALLETS 에 등록된 지갑',
  })
  getHealth(
    @Query('adminWallet') adminWallet: string,
  ): CardhedgerHealthPayload {
    this.assertAdmin(adminWallet);
    return this.health.getFullHealth();
  }

  /** 서킷 브레이커 상태 */
  @Get('circuit')
  @ApiOperation({ summary: '서킷 브레이커 상태' })
  @ApiQuery({ name: 'adminWallet', required: true, example: SWAGGER_FIXTURES.walletAlt })
  getCircuit(
    @Query('adminWallet') adminWallet: string,
  ): CircuitHealth {
    this.assertAdmin(adminWallet);
    return this.health.getCircuitHealth();
  }

  /** resolve·스케줄러 운영 메트릭 */
  @Get('metrics')
  @ApiOperation({ summary: '운영 메트릭' })
  @ApiQuery({ name: 'adminWallet', required: true, example: SWAGGER_FIXTURES.walletAlt })
  getMetrics(
    @Query('adminWallet') adminWallet: string,
  ): { resolve: ResolveHealth; scheduler: SchedulerHealth; timestamp: string } {
    this.assertAdmin(adminWallet);
    return {
      resolve: this.health.getResolveHealth(),
      scheduler: this.health.getSchedulerHealth(),
      timestamp: new Date().toISOString(),
    };
  }

  /** Prometheus scrape (text/plain) */
  @Get('prometheus')
  @ApiOperation({ summary: 'Prometheus 메트릭' })
  @ApiQuery({ name: 'adminWallet', required: true, example: SWAGGER_FIXTURES.walletAlt })
  async getPrometheus(
    @Query('adminWallet') adminWallet: string,
    @Res() res: Response,
  ): Promise<void> {
    this.assertAdmin(adminWallet);
    const text = await this.prometheus.getMetricsText();
    res
      .setHeader('Content-Type', this.prometheus.contentType)
      .send(text);
  }
}
