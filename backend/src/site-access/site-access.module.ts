import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { SiteAccessController } from './site-access.controller';
import { SiteAccessMiddleware } from './site-access.middleware';

@Module({
  controllers: [SiteAccessController],
})
export class SiteAccessModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Named wildcard — Nest 11 / path-to-regexp v8 (avoids LegacyRouteConverter warn on `/api/*`).
    consumer.apply(SiteAccessMiddleware).forRoutes({
      path: '{*path}',
      method: RequestMethod.ALL,
    });
  }
}
