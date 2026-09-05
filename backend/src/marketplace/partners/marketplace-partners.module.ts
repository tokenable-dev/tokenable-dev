import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../../user/user.module';
import { MarketplaceAdminModule } from '../admin/marketplace-admin.module';
import { MarketplacePartnerAddress } from '../entities/marketplace-partner-address.entity';
import { MarketplacePartner } from '../entities/marketplace-partner.entity';
import { MarketplacePartnersService } from './marketplace-partners.service';
import { PartnersAdminController } from './partners-admin.controller';
import { PartnersMeController } from './partners-me.controller';
import { PartnersPublicController } from './partners-public.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MarketplacePartner, MarketplacePartnerAddress]),
    MarketplaceAdminModule,
    UserModule,
  ],
  controllers: [
    PartnersAdminController,
    PartnersPublicController,
    PartnersMeController,
  ],
  providers: [MarketplacePartnersService],
  exports: [MarketplacePartnersService],
})
export class MarketplacePartnersModule {}
