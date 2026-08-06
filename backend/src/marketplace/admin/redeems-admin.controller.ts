import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  AdminRedeemMemoDto,
  AdminRedeemsListQueryDto,
  AdminRedeemShipmentTrackingDto,
  AdminRedeemTrackingDto,
} from './dto/admin-redeems.dto';
import { MarketplaceAdminService } from './marketplace-admin.service';
import { RedeemsAdminService } from './redeems-admin.service';

@ApiTags('marketplace-admin-redeems')
@ApiCookieAuth('marketplace_admin_session')
@Controller('marketplace/admin/redeems')
export class RedeemsAdminController {
  constructor(
    private readonly admin: MarketplaceAdminService,
    private readonly redeems: RedeemsAdminService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List vault redemptions with payment / custody / shipping status for ops',
  })
  list(@Req() req: Request, @Query() query: AdminRedeemsListQueryDto) {
    this.admin.assertAdminSession(req);
    return this.redeems.list({
      status: query.status,
      paymentBatchId: query.paymentBatchId,
      limit: query.limit,
    });
  }

  @Get('batches/:batchId')
  @ApiOperation({ summary: 'Redeem payment-batch detail (all cards in batch)' })
  getBatch(
    @Req() req: Request,
    @Param('batchId', ParseUUIDPipe) batchId: string,
  ) {
    this.admin.assertAdminSession(req);
    return this.redeems.getBatch(batchId);
  }

  @Post('batches/:batchId/refund-usdc')
  @ApiOperation({
    summary:
      'Refund recorded payment_received_usdc_micros once from PLATFORM_FEE to owner wallet',
  })
  refundUsdc(
    @Req() req: Request,
    @Param('batchId', ParseUUIDPipe) batchId: string,
  ) {
    this.admin.assertAdminSession(req);
    return this.redeems.refundUsdcBatch(batchId);
  }

  @Post('batches/:batchId/refund-full')
  @ApiOperation({
    summary:
      'Refund USDC for the batch, then return any NFTs still in custody',
  })
  refundFull(
    @Req() req: Request,
    @Param('batchId', ParseUUIDPipe) batchId: string,
  ) {
    this.admin.assertAdminSession(req);
    return this.redeems.refundFullBatch(batchId);
  }

  @Patch('batches/:batchId/memo')
  @ApiOperation({
    summary: 'Set admin memo on every redemption in the payment batch',
  })
  updateMemoBatch(
    @Req() req: Request,
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @Body() body: AdminRedeemMemoDto,
  ) {
    this.admin.assertAdminSession(req);
    return this.redeems.updateMemoBatch(batchId, body.memo);
  }

  @Patch('batches/:batchId/tracking')
  @ApiOperation({
    summary:
      'Set shipping tracking for one vault shipment (psa_vault | partner:<id>) in the payment batch',
  })
  updateTrackingBatch(
    @Req() req: Request,
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @Body() body: AdminRedeemShipmentTrackingDto,
  ) {
    this.admin.assertAdminSession(req);
    return this.redeems.updateTrackingBatch(batchId, {
      shipmentKey: body.shipmentKey,
      trackingNumber: body.trackingNumber,
      trackingCarrier: body.trackingCarrier,
    });
  }

  @Patch(':id/memo')
  @ApiOperation({ summary: 'Set or clear admin memo on a redemption' })
  updateMemo(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AdminRedeemMemoDto,
  ) {
    this.admin.assertAdminSession(req);
    return this.redeems.updateMemo(id, body.memo);
  }

  @Patch(':id/tracking')
  @ApiOperation({
    summary:
      'Set shipping tracking (blocks further refunds once trackingNumber is set)',
  })
  updateTracking(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AdminRedeemTrackingDto,
  ) {
    this.admin.assertAdminSession(req);
    return this.redeems.updateTracking(id, {
      trackingNumber: body.trackingNumber,
      trackingCarrier: body.trackingCarrier,
    });
  }

  @Post(':id/return-nft')
  @ApiOperation({
    summary: 'Return custody-held NFT to owner_wallet_address',
  })
  returnNft(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.admin.assertAdminSession(req);
    return this.redeems.returnNft(id);
  }
}
