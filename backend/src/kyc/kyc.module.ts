import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { MarketplaceNotificationsModule } from '../marketplace/notifications/marketplace-notifications.module';
import { UserModule } from '../user/user.module';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { SumsubApiService } from './sumsub-api.service';
import { SumsubWebhookController } from './sumsub-webhook.controller';
import { SumsubWebhookService } from './sumsub-webhook.service';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    UserModule,
    MarketplaceNotificationsModule,
  ],
  controllers: [KycController, SumsubWebhookController],
  providers: [KycService, SumsubApiService, SumsubWebhookService],
  exports: [KycService],
})
export class KycModule {}
