import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketplaceAdminModule } from '../admin/marketplace-admin.module';
import { MarketplacePartner } from '../entities/marketplace-partner.entity';
import { MarketplacePartnersService } from './marketplace-partners.service';
import { PartnersAdminController } from './partners-admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MarketplacePartner]),
    MarketplaceAdminModule,
  ],
  controllers: [PartnersAdminController],
  providers: [MarketplacePartnersService],
  exports: [MarketplacePartnersService],
})
export class MarketplacePartnersModule {}
