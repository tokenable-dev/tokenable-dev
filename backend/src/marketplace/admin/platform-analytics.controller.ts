import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminAnalyticsQueryDto } from './dto/admin-analytics.dto';
import { MarketplaceAdminService } from './marketplace-admin.service';
import { PlatformAnalyticsService } from './platform-analytics.service';
import { Ga4AnalyticsService } from './ga4-analytics.service';

@ApiTags('marketplace-admin')
@Controller('marketplace/admin/analytics')
export class PlatformAnalyticsController {
  constructor(
    private readonly admin: MarketplaceAdminService,
    private readonly analytics: PlatformAnalyticsService,
    private readonly ga4Analytics: Ga4AnalyticsService,
  ) {}

  @ApiOperation({
    summary:
      '[Admin] Platform analytics dashboard — KPIs, funnel, time-series, leaderboards',
  })
  @Get()
  dashboard(@Req() req: Request, @Query() query: AdminAnalyticsQueryDto) {
    this.admin.assertAdminSession(req);
    return this.analytics.getDashboard(query.days ?? 30);
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
