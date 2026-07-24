import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { MarketplaceAdminService } from '../admin/marketplace-admin.service';
import { P2pService } from './p2p.service';

@ApiTags('marketplace-admin-p2p')
@Controller('marketplace/admin/p2p')
export class P2pAdminController {
  constructor(
    private readonly admin: MarketplaceAdminService,
    private readonly p2p: P2pService,
  ) {}

  @Get('orders')
  @ApiOperation({ summary: 'List P2P orders (admin)' })
  listOrders(@Req() req: Request, @Query('status') status?: string) {
    this.admin.assertAdminSession(req);
    return this.p2p.adminListOrders(status);
  }

  @Post('orders/:id/refund')
  @ApiOperation({ summary: 'Arbiter refund + burn NFT' })
  refund(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    this.admin.assertAdminSession(req);
    return this.p2p.adminRefund(id);
  }
}
