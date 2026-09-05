import {
  Controller,
  Get,
  Header,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { MarketplaceAdminService } from '../../marketplace/admin/marketplace-admin.service';
import { CardhedgerHealthService } from './cardhedger-health.service';
import { CardhedgerPrometheusService } from './cardhedger-prometheus.service';
import type {
  CardhedgerHealthPayload,
  CircuitHealth,
  ResolveHealth,
  SchedulerHealth,
} from './cardhedger-health.service';

/**
 * Cardhedger 연동 헬스·메트릭 (marketplace admin session cookie required).
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

  private assertAdmin(req: Request): void {
    this.adminService.assertAdminSession(req);
  }

  /** Cardhedger 통합 헬스 (서킷·resolve·스케줄러) */
  @Get('health')
  @ApiOperation({ summary: 'Cardhedger 통합 헬스' })
  getHealth(@Req() req: Request): CardhedgerHealthPayload {
    this.assertAdmin(req);
    return this.health.getFullHealth();
  }

  /** 서킷 브레이커 상태 */
  @Get('circuit')
  @ApiOperation({ summary: '서킷 브레이커 상태' })
  getCircuit(@Req() req: Request): CircuitHealth {
    this.assertAdmin(req);
    return this.health.getCircuitHealth();
  }

  /** resolve·스케줄러 운영 메트릭 */
  @Get('metrics')
  @ApiOperation({ summary: '운영 메트릭' })
  getMetrics(@Req() req: Request): {
    resolve: ResolveHealth;
    scheduler: SchedulerHealth;
    timestamp: string;
  } {
    this.assertAdmin(req);
    return {
      resolve: this.health.getResolveHealth(),
      scheduler: this.health.getSchedulerHealth(),
      timestamp: new Date().toISOString(),
    };
  }

  /** Prometheus scrape (text/plain) */
  @Get('prometheus')
  @ApiOperation({ summary: 'Prometheus 메트릭' })
  async getPrometheus(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.assertAdmin(req);
    const text = await this.prometheus.getMetricsText();
    res
      .setHeader('Content-Type', this.prometheus.contentType)
      .send(text);
  }
}
