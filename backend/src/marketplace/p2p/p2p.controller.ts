import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  CHAIN_ID_HEADER,
  ChainConfigService,
} from '../../blockchain/chain-config.service';
import { ApiChainIdHeader } from '../../swagger/api-headers.util';
import type { User } from '../../user/entities/user.entity';
import { CreateP2pListingDto } from './dto/create-p2p-listing.dto';
import { RecordP2pDepositDto } from './dto/record-p2p-deposit.dto';
import { RecordP2pSettlementDto } from './dto/record-p2p-settlement.dto';
import { SetP2pTrackingDto } from './dto/set-p2p-tracking.dto';
import { P2pService } from './p2p.service';

@ApiTags('p2p')
@ApiChainIdHeader()
@Controller('marketplace/p2p')
export class P2pController {
  constructor(
    private readonly p2p: P2pService,
    private readonly chainConfig: ChainConfigService,
  ) {}

  @Get('listings')
  @ApiOperation({ summary: 'Active P2P listings (request chain)' })
  listActive(@Headers(CHAIN_ID_HEADER) chainHeader?: string) {
    return this.p2p.listActiveListings(
      this.chainConfig.resolveChainId(chainHeader),
    );
  }

  @Get('listings/:id')
  getListing(@Param('id', ParseUUIDPipe) id: string) {
    return this.p2p.getListing(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('listings')
  @ApiOperation({ summary: 'Mint to custody + create P2P listing' })
  createListing(
    @Req() req: Request & { user: User },
    @Body() dto: CreateP2pListingDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    return this.p2p.createListing(
      req.user,
      dto,
      this.chainConfig.requireChainId(chainHeader),
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('listings/:id/cancel')
  cancelListing(
    @Req() req: Request & { user: User },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.p2p.cancelListing(req.user, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/listings')
  myListings(@Req() req: Request & { user: User }) {
    return this.p2p.listSellerListingsWithPayout(req.user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/orders')
  myOrders(
    @Req() req: Request & { user: User },
    @Query('role') role?: 'buyer' | 'seller',
  ) {
    if (role === 'seller') return this.p2p.listSellerOrders(req.user.id);
    return this.p2p.listBuyerOrders(req.user.id);
  }

  @Get('listings/:id/prepare-buy')
  @ApiOperation({ summary: 'Escrow params for buyer createAndDeposit' })
  prepareBuy(@Param('id', ParseUUIDPipe) id: string) {
    return this.p2p.prepareBuy(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('listings/:id/deposit')
  @ApiOperation({ summary: 'Record funded escrow after on-chain deposit' })
  recordDeposit(
    @Req() req: Request & { user: User },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordP2pDepositDto,
  ) {
    return this.p2p.recordDeposit(req.user, id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('orders/:id')
  @ApiOperation({ summary: 'Order detail (buyer/seller only — includes ship-to)' })
  getOrder(
    @Req() req: Request & { user: User },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.p2p.getOrderForUser(req.user, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('orders/:id/tracking')
  setTracking(
    @Req() req: Request & { user: User },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetP2pTrackingDto,
  ) {
    return this.p2p.setTracking(req.user, id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('orders/:id/settle')
  @ApiOperation({ summary: 'Record confirmReceipt / timeout release + burn NFT' })
  settle(
    @Req() req: Request & { user: User },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordP2pSettlementDto,
  ) {
    return this.p2p.recordSettlement(req.user, id, dto);
  }
}
