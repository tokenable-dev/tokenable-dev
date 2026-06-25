import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { VerificationToken } from '../../auth/entities/verification-token.entity';
import { UserModule } from '../../user/user.module';
import { User } from '../../user/entities/user.entity';
import { UserWallet } from '../../user/entities/user-wallet.entity';
import { UserWatchlist } from '../entities/user-watchlist.entity';
import { MarketplaceAdmin } from '../entities/marketplace-admin.entity';
import { MarketplaceAdminAuthController } from './marketplace-admin-auth.controller';
import { MarketplaceAdminBootstrapService } from './marketplace-admin-bootstrap.service';
import { MarketplaceAdminService } from './marketplace-admin.service';
import { UserAdminController } from './user-admin.controller';
import { UserAdminService } from './user-admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MarketplaceAdmin,
      User,
      UserWallet,
      UserWatchlist,
      VerificationToken,
    ]),
    UserModule,
    AuthModule,
  ],
  controllers: [MarketplaceAdminAuthController, UserAdminController],
  providers: [
    MarketplaceAdminService,
    MarketplaceAdminBootstrapService,
    UserAdminService,
  ],
  exports: [MarketplaceAdminService],
})
export class MarketplaceAdminModule {}
