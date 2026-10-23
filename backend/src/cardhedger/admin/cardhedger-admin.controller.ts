import {
  Controller,
  Get,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { readCardhedgerFeatureFlags } from '../../config/cardhedger-feature-flags.util';
import { MarketplaceAdminService } from '../../marketplace/admin/marketplace-admin.service';
import { buildCardhedgerPriceInfraStatus } from '../cardhedger-price-infra-status';
import { CardhedgerDailyPriceExportRun } from '../entities/cardhedger-daily-price-export-run.entity';
import { CardhedgerPriceDeltaCheckpoint } from '../entities/cardhedger-price-delta-checkpoint.entity';
import { CardhedgerPriceDeltaImportRun } from '../entities/cardhedger-price-delta-import-run.entity';
import { CardhedgerPriceSubscription } from '../entities/cardhedger-price-subscription.entity';
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
    private readonly config: ConfigService,
    @InjectRepository(CardhedgerPriceDeltaCheckpoint)
    private readonly checkpointRepo: Repository<CardhedgerPriceDeltaCheckpoint>,
    @InjectRepository(CardhedgerPriceDeltaImportRun)
    private readonly deltaRunRepo: Repository<CardhedgerPriceDeltaImportRun>,
    @InjectRepository(CardhedgerDailyPriceExportRun)
    private readonly exportRunRepo: Repository<CardhedgerDailyPriceExportRun>,
    @InjectRepository(CardhedgerPriceSubscription)
    private readonly subscriptionRepo: Repository<CardhedgerPriceSubscription>,
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

  /** Works when PriceInfra workers are not loaded (flags off). */
  @Get('price-subscriptions/status')
  @ApiOperation({ summary: 'Cardhedger price delta / subscribe infra status' })
  async getPriceInfraStatus(@Req() req: Request) {
    this.assertAdmin(req);
    const flags =
      this.config.get<ReturnType<typeof readCardhedgerFeatureFlags>>(
        'marketplace.cardhedgerFeatureFlags',
      ) ?? readCardhedgerFeatureFlags();
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL')?.trim().replace(/\/$/, '') ?? '';
    const clientId = this.config.get<string>('CARDHEDGER_CLIENT_ID')?.trim() ?? '';
    const [checkpoint, recentDeltaRuns, recentCsvRuns, activeSubscriptions] =
      await Promise.all([
        this.checkpointRepo.findOne({ where: { id: 1 } }),
        this.deltaRunRepo.find({
          order: { ranAt: 'DESC' },
          take: 12,
        }),
        this.exportRunRepo.find({
          where: { source: 'csv_export' },
          order: { ranAt: 'DESC' },
          take: 4,
        }),
        this.subscriptionRepo.count({ where: { active: true } }),
      ]);
    return buildCardhedgerPriceInfraStatus({
      flags,
      frontendUrl,
      webhookSecretConfigured: Boolean(
        this.config.get<string>('CARDHEDGER_WEBHOOK_SECRET')?.trim(),
      ),
      clientId,
      checkpoint,
      recentDeltaRuns,
      recentCsvRuns,
      activeSubscriptions,
      cronEnv: {
        CARDHEDGER_PRICE_DELTA_CRON_ENABLED: this.config.get<string>(
          'CARDHEDGER_PRICE_DELTA_CRON_ENABLED',
        ),
        NODE_ENV: this.config.get<string>('NODE_ENV'),
      },
    });
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
