import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { MarketplaceAdminService } from '../../marketplace/admin/marketplace-admin.service';
import {
  CHAIN_ID_HEADER,
  ChainConfigService,
} from '../../blockchain/chain-config.service';
import { ApiChainIdHeader } from '../../swagger/api-headers.util';
import { AdminRwaSlabBackfillDto } from '../dto/admin-rwa-slab-backfill.dto';
import { RwaSlabBackfillService } from '../rwa-slab-backfill.service';

@ApiTags('marketplace-admin')
@ApiCookieAuth('marketplace_admin_session')
@ApiChainIdHeader()
@Controller('marketplace/admin/rwa-slab')
export class RwaSlabAdminController {
  constructor(
    private readonly admin: MarketplaceAdminService,
    private readonly backfill: RwaSlabBackfillService,
    private readonly chainConfig: ChainConfigService,
  ) {}

  @Post('backfill-display-images')
  @ApiOperation({
    summary:
      'Backfill rwa_tokens.display_image_url from IPFS metadata → S3 (best-effort per row)',
  })
  async backfillDisplayImages(
    @Req() req: Request,
    @Body() body: AdminRwaSlabBackfillDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    this.admin.assertAdminSession(req);
    const chainId = this.chainConfig.resolveChainId(chainHeader);
    return this.backfill.backfillMissingDisplayImages({
      limit: body.limit,
      dryRun: body.dryRun,
      chainId,
    });
  }
}
