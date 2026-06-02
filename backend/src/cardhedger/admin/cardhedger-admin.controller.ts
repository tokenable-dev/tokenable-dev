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
import type {
  CardhedgerHealthPayload,
  CircuitHealth,
  ResolveHealth,
  SchedulerHealth,
} from './cardhedger-health.service';

/**
 * Read-only admin surface for Cardhedger integration health.
 *
 * Authorization: `adminWallet` query parameter — must be a wallet address
 * present in `marketplace.adminWallets` (env: `MARKETPLACE_ADMIN_WALLETS`).
 *
 * All routes are under the global `api` prefix → effective paths:
 *   GET /api/admin/cardhedger/health
 *   GET /api/admin/cardhedger/circuit
 *   GET /api/admin/cardhedger/metrics
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

  // ─── Endpoints ─────────────────────────────────────────────────────────────

  @Get('health')
  @ApiOperation({
    summary:
      'Full Cardhedger integration health: circuit breaker + resolve path metrics + snapshot scheduler state',
  })
  @ApiQuery({
    name: 'adminWallet',
    required: true,
    description: 'Caller admin wallet address (must be in MARKETPLACE_ADMIN_WALLETS)',
  })
  getHealth(
    @Query('adminWallet') adminWallet: string,
  ): CardhedgerHealthPayload {
    this.assertAdmin(adminWallet);
    return this.health.getFullHealth();
  }

  @Get('circuit')
  @ApiOperation({
    summary: 'Circuit breaker state: CLOSED / OPEN / HALF_OPEN + consecutive failures + open duration',
  })
  @ApiQuery({ name: 'adminWallet', required: true })
  getCircuit(
    @Query('adminWallet') adminWallet: string,
  ): CircuitHealth {
    this.assertAdmin(adminWallet);
    return this.health.getCircuitHealth();
  }

  @Get('metrics')
  @ApiOperation({
    summary:
      'Resolve path distribution, search depth average, scheduler queue depth, and batch reduction counters for the current metrics window',
  })
  @ApiQuery({ name: 'adminWallet', required: true })
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

  @Get('prometheus')
  @ApiOperation({
    summary:
      'Prometheus text exposition format scrape endpoint for all Cardhedger operational metrics. Returns text/plain.',
  })
  @ApiQuery({ name: 'adminWallet', required: true })
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
