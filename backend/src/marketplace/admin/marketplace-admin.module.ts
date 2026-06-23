import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketplaceAdmin } from '../entities/marketplace-admin.entity';
import { MarketplaceAdminAuthController } from './marketplace-admin-auth.controller';
import { MarketplaceAdminBootstrapService } from './marketplace-admin-bootstrap.service';
import { MarketplaceAdminService } from './marketplace-admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([MarketplaceAdmin])],
  controllers: [MarketplaceAdminAuthController],
  providers: [MarketplaceAdminService, MarketplaceAdminBootstrapService],
  exports: [MarketplaceAdminService],
})
export class MarketplaceAdminModule {}
