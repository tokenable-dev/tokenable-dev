/**
 * Smoke: `pnpm exec ts-node -r tsconfig-paths/register scripts/smoke-platform-analytics.ts`
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PlatformAnalyticsService } from '../src/marketplace/admin/platform-analytics.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const analytics = app.get(PlatformAnalyticsService);
    const dash = await analytics.getDashboard(30);
    console.log(
      JSON.stringify(
        {
          ok: true,
          users: dash.overview.users.total,
          sales: dash.overview.orders.fulfilledSales,
          topPages: dash.topCollections.bySales.length,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('SMOKE_FAILED', err);
  process.exit(1);
});
