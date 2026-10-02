import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { BlockchainModule } from '../../blockchain/blockchain.module';
import { UserModule } from '../../user/user.module';
import { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import { MarketplaceNotification } from '../entities/marketplace-notification.entity';
import { Order } from '../entities/order.entity';
import { RwaToken } from '../entities/rwa-token.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      MarketplaceNotification,
      Order,
      RwaToken,
      MarketplaceCollection,
    ]),
    AuthModule,
    UserModule,
    BlockchainModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class MarketplaceNotificationsModule {}
