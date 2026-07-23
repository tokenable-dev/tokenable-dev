import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { UserModule } from '../../user/user.module';
import { MarketplaceNotification } from '../entities/marketplace-notification.entity';
import { Order } from '../entities/order.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MarketplaceNotification, Order]),
    AuthModule,
    UserModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class MarketplaceNotificationsModule {}
