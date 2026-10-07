import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Patch, Put, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { User } from '../../user/entities/user.entity';
import {
  AdminRedeemsListQueryDto,
  PartnerRedeemShipmentTrackingDto,
} from '../admin/dto/admin-redeems.dto';
import { RedeemsAdminService } from '../admin/redeems-admin.service';
import { UpsertMarketplacePartnerAddressDto } from './dto/marketplace-partner-address.dto';
import { MarketplacePartnersService } from './marketplace-partners.service';

/**
 * Partner-facing company Origin address + redeem shipments for Partner vault.
 * Partner is resolved via JWT user wallets ∩ marketplace_partners.
 */
@ApiTags('marketplace')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('marketplace/partners/me')
export class PartnersMeController {
  constructor(
    private readonly partners: MarketplacePartnersService,
    private readonly redeems: RedeemsAdminService,
  ) {}

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

  @Get('redeems')
  @ApiOperation({
    summary:
      'List Partner-vault redemptions for the signed-in partner (to ship / shipped)',
  })
  async listRedeems(
    @Req() req: Request & { user: User },
    @Query() query: AdminRedeemsListQueryDto,
  ) {
    const partnerId = await this.requireActivePartnerId(req.user.id);
    return this.redeems.listForPartner(partnerId, { limit: query.limit });
  }

  @Patch('redeems/batches/:batchId/tracking')
  @ApiOperation({
    summary:
      'Set shipping tracking for this partner’s shipment within a payment batch',
  })
  async updateRedeemTracking(
    @Req() req: Request & { user: User },
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @Body() body: PartnerRedeemShipmentTrackingDto,
  ) {
    const partnerId = await this.requireActivePartnerId(req.user.id);
    return this.redeems.updateTrackingBatchForPartner(partnerId, batchId, {
      shipmentKey: body.shipmentKey,
      trackingNumber: body.trackingNumber,
      trackingCarrier: body.trackingCarrier,
      redemptionIds: body.redemptionIds,
    });
  }

  private async requireActivePartnerId(userId: string): Promise<string> {
    const session = await this.partners.getPartnerMe(userId);
    if (!session.isPartner || !session.partnerId) {
      throw new ForbiddenException('Active partner account required');
    }
    return session.partnerId;
  }
}
