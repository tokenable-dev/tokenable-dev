import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { SiteAccessController } from './site-access.controller';
import { SiteAccessMiddleware } from './site-access.middleware';

@Module({
  controllers: [SiteAccessController],
})
export class SiteAccessModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SiteAccessMiddleware).forRoutes('*');
  }
}
