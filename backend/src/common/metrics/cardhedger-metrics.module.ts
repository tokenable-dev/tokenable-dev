import { Global, Module } from '@nestjs/common';
import { CardhedgerMetricsService } from './cardhedger-metrics.service';

/**
 * Global metrics aggregator for Cardhedger integration health.
 * Registered as `@Global()` so all feature modules (CardhedgerModule,
 * MarketplaceMarketDataModule, MarketplaceSnapshotsModule) can inject
 * `CardhedgerMetricsService` without explicit module imports.
 *
 * Import once in `AppModule`.
 */
@Global()
@Module({
  providers: [CardhedgerMetricsService],
  exports: [CardhedgerMetricsService],
})
export class CardhedgerMetricsModule {}
