import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { readCardhedgerFeatureFlags } from '../../config/cardhedger-feature-flags.util';
import { MarketplaceAdminService } from '../../marketplace/admin/marketplace-admin.service';
import { CardhedgerPriceDeltaImportService } from '../cardhedger-price-delta-import.service';
import { CardhedgerPriceDeltaSchedulerService } from '../cardhedger-price-delta-scheduler.service';
import { CardhedgerPriceSubscriptionService } from '../cardhedger-price-subscription.service';
import { CardhedgerDailyPriceExportRun } from '../entities/cardhedger-daily-price-export-run.entity';
import { CardhedgerPriceDeltaCheckpoint } from '../entities/cardhedger-price-delta-checkpoint.entity';
import { CardhedgerPriceDeltaImportRun } from '../entities/cardhedger-price-delta-import-run.entity';

class SyncSubscriptionsDto {
  limit?: number;
}

function serializeDeltaRun(run: CardhedgerPriceDeltaImportRun) {
  return {
    id: run.id,
    ranAt: run.ranAt.toISOString(),
    sinceIso: run.sinceIso,
    latestTimestampIso: run.latestTimestampIso,
    updateCount: run.updateCount,
    uniqueCardIds: run.uniqueCardIds,
    matchedCollectionCount: run.matchedCollectionCount,
    deltaMatchedCollectionCount: run.deltaMatchedCollectionCount ?? 0,
    catalogFallbackCount: run.catalogFallbackCount ?? 0,
    unmatchedUpdateCount: run.unmatchedUpdateCount,
    enqueuedCollectionKeys: run.enqueuedCollectionKeys,
    matchedCollections: run.matchedCollections,
    status: run.status,
    errorMessage: run.errorMessage,
  };
}

@ApiTags('admin')
@Controller('admin/cardhedger/price-subscriptions')
export class CardhedgerPriceSubscriptionAdminController {
  constructor(
    private readonly admin: MarketplaceAdminService,
    private readonly subscriptions: CardhedgerPriceSubscriptionService,
    private readonly deltaScheduler: CardhedgerPriceDeltaSchedulerService,
    private readonly deltaImport: CardhedgerPriceDeltaImportService,
    private readonly config: ConfigService,
    @InjectRepository(CardhedgerPriceDeltaCheckpoint)
    private readonly checkpointRepo: Repository<CardhedgerPriceDeltaCheckpoint>,
    @InjectRepository(CardhedgerDailyPriceExportRun)
    private readonly exportRunRepo: Repository<CardhedgerDailyPriceExportRun>,
  ) {}

  private assertAdmin(req: Request): void {
    this.admin.assertAdminSession(req);
  }

  private featureFlags() {
    return (
      this.config.get<ReturnType<typeof readCardhedgerFeatureFlags>>(
        'marketplace.cardhedgerFeatureFlags',
      ) ?? readCardhedgerFeatureFlags()
    );
  }

  @Get('status')
  @ApiOperation({ summary: 'Cardhedger price delta / subscribe infra status' })
  async status(@Req() req: Request) {
    this.assertAdmin(req);
    const flags = this.featureFlags();
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL')?.trim().replace(/\/$/, '') ?? '';
    const webhookSecret = this.config
      .get<string>('CARDHEDGER_WEBHOOK_SECRET')
      ?.trim();
    const clientId = this.config.get<string>('CARDHEDGER_CLIENT_ID')?.trim();
    const subscribeAvailable =
      Boolean(clientId) && flags.priceSubscribeEnabled;

    const checkpoint = await this.checkpointRepo.findOne({ where: { id: 1 } });
    const recentDeltaRuns = await this.deltaImport.listDeltaImportRuns(12);
    const recentCsvRuns = await this.exportRunRepo.find({
      where: { source: 'csv_export' },
      order: { ranAt: 'DESC' },
      take: 4,
    });
    const activeSubscriptions = await this.subscriptions.countActiveSubscriptions();

    return {
      mode: subscribeAvailable ? 'subscribe_and_poll' : 'delta_poll_only',
      flags: {
        priceWebhookEnabled: flags.priceWebhookEnabled,
        priceSubscribeEnabled: flags.priceSubscribeEnabled,
        dailyPriceDeltaImportEnabled: flags.dailyPriceDeltaImportEnabled,
        dailyPriceExportCsvEnabled: flags.dailyPriceExportCsvEnabled,
      },
      webhookUrl: frontendUrl
        ? `${frontendUrl}/api/webhooks/cardhedger/price-updates`
        : null,
      webhookAuthHeader: 'X-Cardhedger-Webhook-Secret',
      webhookSecretConfigured: Boolean(webhookSecret),
      clientIdConfigured: Boolean(clientId),
      clientIdHint: clientId
        ? `${clientId.slice(0, Math.min(6, clientId.length))}…`
        : null,
      subscribeAvailable,
      deltaCronEnabled: this.deltaScheduler.cronEnabled(),
      lastDeltaSince: checkpoint?.lastSinceIso ?? null,
      lastDeltaCheckpointAt: checkpoint?.updatedAt?.toISOString() ?? null,
      activeSubscriptions,
      recentDeltaRuns: recentDeltaRuns.map(serializeDeltaRun),
      recentCsvRuns: recentCsvRuns.map((run) => ({
        fileDate: run.fileDate,
        source: run.source,
        status: run.status,
        rowCount: run.rowCount,
        errorMessage: run.errorMessage,
        ranAt: run.ranAt.toISOString(),
      })),
    };
  }

  @Get('delta-runs')
  @ApiOperation({ summary: 'List delta import run history' })
  async listDeltaRuns(@Req() req: Request, @Query('limit') limit?: string) {
    this.assertAdmin(req);
    const rows = await this.deltaImport.listDeltaImportRuns(
      limit != null ? Number(limit) : 20,
    );
    return { items: rows.map(serializeDeltaRun) };
  }

  @Get('delta-runs/:id')
  @ApiOperation({ summary: 'Get one delta import run with full detail' })
  @ApiParam({ name: 'id' })
  async getDeltaRun(@Req() req: Request, @Param('id') id: string) {
    this.assertAdmin(req);
    const run = await this.deltaImport.getDeltaImportRun(Number(id));
    if (!run) throw new NotFoundException('Delta import run not found');
    return serializeDeltaRun(run);
  }

  @Get()
  @ApiOperation({ summary: 'List Cardhedger price subscription records' })
  async list(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('active') active?: string,
  ) {
    this.assertAdmin(req);
    return this.subscriptions.listSubscriptions({
      limit: limit != null ? Number(limit) : undefined,
      offset: offset != null ? Number(offset) : undefined,
      activeOnly: active === '1' || active === 'true',
    });
  }

  @Post('sync')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Subscribe active collections to Cardhedger price updates (requires client_id)',
  })
  async sync(@Req() req: Request, @Body() body: SyncSubscriptionsDto) {
    this.assertAdmin(req);
    const limit = Math.min(2000, Math.max(1, Math.floor(body?.limit ?? 500)));
    return this.subscriptions.syncActiveSubscriptions(limit);
  }

  @Post('nightly-delta/run')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Run price-updates delta poll now (API key only — no client_id)',
  })
  async runDeltaImport(@Req() req: Request) {
    this.assertAdmin(req);
    const result = await this.deltaScheduler.run('manual');
    if (!result) {
      return { ok: false, skipped: 'in_flight' as const };
    }
    return { ok: true, ...result };
  }

  @Post(':collectionKey')
  @HttpCode(200)
  @ApiOperation({ summary: 'Subscribe a single collection (requires client_id)' })
  @ApiParam({ name: 'collectionKey' })
  async subscribe(@Req() req: Request, @Param('collectionKey') collectionKey: string) {
    this.assertAdmin(req);
    return this.subscriptions.subscribeCollection(collectionKey);
  }

  @Delete(':collectionKey')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Deactivate local subscription record (no upstream unsubscribe API)',
  })
  @ApiParam({ name: 'collectionKey' })
  async unsubscribe(@Req() req: Request, @Param('collectionKey') collectionKey: string) {
    this.assertAdmin(req);
    return this.subscriptions.unsubscribeCollection(collectionKey);
  }
}
