import { Module } from '@nestjs/common';
import { CardhedgerModule } from '../cardhedger.module';
import { MarketplaceAdminModule } from '../../marketplace/admin/marketplace-admin.module';
import { CardhedgerAdminController } from './cardhedger-admin.controller';
import { CardhedgerHealthService } from './cardhedger-health.service';
import { CardhedgerPrometheusService } from './cardhedger-prometheus.service';

/**
 * Read-only admin surface for Cardhedger integration observability.
 *
 * Only imports CardhedgerModule. No marketplace module import is needed because:
 *
 *   - CardhedgerService      → provided by CardhedgerModule
 *   - CardhedgerMetricsService → @Global() provider (no explicit import required)
 *   - MarketplaceAdminModule → admin session guard for ops endpoints
 *   - Scheduler state          → pushed into CardhedgerMetricsService by the scheduler
 *     on every cron tick via `recordSchedulerState()`; no direct injection needed.
 *
 * Importing any marketplace submodule from here (MarketplaceModule,
 * MarketplaceSnapshotsModule, etc.) causes NestJS to attempt a second
 * initialization of MarketplaceCollectionsModule in a context where
 * CollectionMarketSnapshotService is not yet resolved — an unrecoverable
 * circular module context. The push-based state pattern above avoids this entirely.
 */
@Module({
  imports: [CardhedgerModule, MarketplaceAdminModule],
  controllers: [CardhedgerAdminController],
  providers: [CardhedgerHealthService, CardhedgerPrometheusService],
})
export class CardhedgerAdminModule {}
