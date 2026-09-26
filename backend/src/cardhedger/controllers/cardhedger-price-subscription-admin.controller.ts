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
import type { Request } from 'express';
import { MarketplaceAdminService } from '../../marketplace/admin/marketplace-admin.service';
import { CardhedgerPriceDeltaImportService } from '../cardhedger-price-delta-import.service';
import { serializeCardhedgerDeltaRun } from '../cardhedger-price-infra-status';
import { CardhedgerPriceDeltaSchedulerService } from '../cardhedger-price-delta-scheduler.service';
import { CardhedgerPriceSubscriptionService } from '../cardhedger-price-subscription.service';

class SyncSubscriptionsDto {
  limit?: number;
}

@ApiTags('admin')
@Controller('admin/cardhedger/price-subscriptions')
export class CardhedgerPriceSubscriptionAdminController {
  constructor(
    private readonly admin: MarketplaceAdminService,
    private readonly subscriptions: CardhedgerPriceSubscriptionService,
    private readonly deltaScheduler: CardhedgerPriceDeltaSchedulerService,
    private readonly deltaImport: CardhedgerPriceDeltaImportService,
  ) {}

  private assertAdmin(req: Request): void {
    this.admin.assertAdminSession(req);
  }

  @Get('delta-runs')
  @ApiOperation({ summary: 'List delta import run history' })
  async listDeltaRuns(@Req() req: Request, @Query('limit') limit?: string) {
    this.assertAdmin(req);
    const rows = await this.deltaImport.listDeltaImportRuns(
      limit != null ? Number(limit) : 20,
    );
    return { items: rows.map(serializeCardhedgerDeltaRun) };
  }

  @Get('delta-runs/:id')
  @ApiOperation({ summary: 'Get one delta import run with full detail' })
  @ApiParam({ name: 'id' })
  async getDeltaRun(@Req() req: Request, @Param('id') id: string) {
    this.assertAdmin(req);
    const run = await this.deltaImport.getDeltaImportRun(Number(id));
    if (!run) throw new NotFoundException('Delta import run not found');
    return serializeCardhedgerDeltaRun(run);
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
