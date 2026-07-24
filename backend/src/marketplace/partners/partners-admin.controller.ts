import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { MarketplaceAdminService } from '../admin/marketplace-admin.service';
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

  @Post()
  @ApiOperation({
    summary: 'Register partner company wallet (private key encrypted at rest)',
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
