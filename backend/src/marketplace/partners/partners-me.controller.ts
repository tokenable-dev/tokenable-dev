import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { User } from '../../user/entities/user.entity';
import { UpsertMarketplacePartnerAddressDto } from './dto/marketplace-partner-address.dto';
import { MarketplacePartnersService } from './marketplace-partners.service';

/**
 * Partner-facing company Origin address (Self vault FedEx ship-from).
 * Partner is resolved via JWT user wallets ∩ marketplace_partners.
 */
@ApiTags('marketplace')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('marketplace/partners/me')
export class PartnersMeController {
  constructor(private readonly partners: MarketplacePartnersService) {}

  @Get()
  @ApiOperation({
    summary:
      'Whether the signed-in user is an active partner and company vault address status',
  })
  async me(@Req() req: Request & { user: User }) {
    return this.partners.getPartnerMe(req.user.id);
  }

  @Get('company-address')
  @ApiOperation({ summary: 'Get company / Self-vault Origin address' })
  async getCompanyAddress(@Req() req: Request & { user: User }) {
    const session = await this.partners.getPartnerMe(req.user.id);
    return {
      isPartner: session.isPartner,
      partnerId: session.partnerId,
      hasCompanyAddress: session.hasCompanyAddress,
      address: session.companyAddress,
    };
  }

  @Put('company-address')
  @ApiOperation({
    summary:
      'Create or replace company / Self-vault Origin address (FedEx Rate origin)',
  })
  async putCompanyAddress(
    @Req() req: Request & { user: User },
    @Body() body: UpsertMarketplacePartnerAddressDto,
  ) {
    const address = await this.partners.upsertCompanyAddressForUser(
      req.user.id,
      body,
    );
    return { address };
  }
}
