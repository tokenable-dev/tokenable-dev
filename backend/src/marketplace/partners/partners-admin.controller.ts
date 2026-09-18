import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { MarketplaceAdminService } from '../admin/marketplace-admin.service';
import { UpsertMarketplacePartnerAddressDto } from './dto/marketplace-partner-address.dto';
import {
  CreateMarketplacePartnerDto,
  UpdateMarketplacePartnerDto,
} from './dto/marketplace-partner.dto';
import { MarketplacePartnersService } from './marketplace-partners.service';

@ApiTags('marketplace-admin')
@ApiCookieAuth('marketplace_admin_session')
@Controller('marketplace/admin/partners')
export class PartnersAdminController {
  constructor(
    private readonly admin: MarketplaceAdminService,
    private readonly partners: MarketplacePartnersService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List consignment partners (no private key material)',
  })
  async list(@Req() req: Request) {
    this.admin.assertAdminSession(req);
    return this.partners.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get partner by id (no private key material)' })
  async get(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    this.admin.assertAdminSession(req);
    return this.partners.getPublicOrThrow(id);
  }

  @Get(':id/company-address')
  @ApiOperation({ summary: 'Get partner company / Self-vault Origin address' })
  async getCompanyAddress(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.admin.assertAdminSession(req);
    await this.partners.getOrThrow(id);
    const address = await this.partners.findAddressByPartnerId(id);
    return {
      partnerId: id,
      hasCompanyAddress: Boolean(address),
      address: address ? this.partners.toAddressPublic(address) : null,
    };
  }

  @Put(':id/company-address')
  @ApiOperation({
    summary: 'Create or replace partner company / Self-vault Origin address',
  })
  async putCompanyAddress(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpsertMarketplacePartnerAddressDto,
  ) {
    this.admin.assertAdminSession(req);
    const address = await this.partners.upsertCompanyAddressForPartner(
      id,
      body,
    );
    return { address };
  }

  @Post()
  @ApiOperation({
    summary:
      'Register partner wallet for Self vault (privateKey optional; required later for bulk mint)',
  })
  async create(@Req() req: Request, @Body() body: CreateMarketplacePartnerDto) {
    this.admin.assertAdminSession(req);
    return this.partners.create(body);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update display name, active flag, or rotate private key',
  })
  async update(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateMarketplacePartnerDto,
  ) {
    this.admin.assertAdminSession(req);
    return this.partners.update(id, body);
  }
}
