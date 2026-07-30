import { Controller, Get, Headers, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CHAIN_ID_HEADER,
  ChainConfigService,
} from '../../blockchain/chain-config.service';
import { ApiChainIdHeader } from '../../swagger/api-headers.util';
import { AdminAnalyticsQueryDto } from './dto/admin-analytics.dto';
import { MarketplaceAdminService } from './marketplace-admin.service';
import { PlatformAnalyticsService } from './platform-analytics.service';
import { Ga4AnalyticsService } from './ga4-analytics.service';

@ApiTags('marketplace-admin')
@ApiChainIdHeader()
@Controller('marketplace/admin/analytics')
export class PlatformAnalyticsController {
  constructor(
    private readonly admin: MarketplaceAdminService,
    private readonly analytics: PlatformAnalyticsService,
    private readonly ga4Analytics: Ga4AnalyticsService,
    private readonly chainConfig: ChainConfigService,
  ) {}

  @ApiOperation({
    summary:
      '[Admin] Platform analytics dashboard — KPIs, funnel, time-series, leaderboards (chain-scoped inventory/orders)',
  })
  @Get()
  dashboard(
    @Req() req: Request,
    @Query() query: AdminAnalyticsQueryDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    this.admin.assertAdminSession(req);
    return this.analytics.getDashboard(
      query.days ?? 30,
      this.chainConfig.resolveChainId(chainHeader),
    );
  }

  @ApiOperation({
    summary:
      '[Admin] GA4 traffic — page views, engagement, top pages (Data API)',
  })
  @Get('ga4')
  ga4(@Req() req: Request, @Query() query: AdminAnalyticsQueryDto) {
    this.admin.assertAdminSession(req);
    return this.ga4Analytics.getDashboard(query.days ?? 30);
  }
}
