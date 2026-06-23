import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { MarketplaceAdminService } from '../admin/marketplace-admin.service';
import {
  AdminRwaTokenActionDto,
  AdminRwaTokenListQueryDto,
  AdminUpdateRwaTokenDto,
} from './dto/admin-rwa-token.dto';
import { RwaTokenAdminService } from './rwa-token-admin.service';

@ApiTags('marketplace-admin')
@Controller('marketplace/admin/rwa-tokens')
export class RwaTokenAdminController {
  constructor(
    private readonly admin: MarketplaceAdminService,
    private readonly rwaTokenAdmin: RwaTokenAdminService,
  ) {}

  @ApiOperation({ summary: '[Admin] Active listed RWA cards overview' })
  @Get('listings')
  async listListedCards(
    @Req() req: Request,
    @Query() _query: AdminRwaTokenListQueryDto,
  ) {
    this.admin.assertAdminSession(req);
    return this.rwaTokenAdmin.listActiveListedCards();
  }

  @ApiOperation({ summary: '[Admin] Update RWA token registry fields' })
  @ApiParam({ name: 'tokenId', example: 1 })
  @Patch(':tokenId')
  async updateToken(
    @Req() req: Request,
    @Param('tokenId', ParseIntPipe) tokenId: number,
    @Body() body: AdminUpdateRwaTokenDto,
  ) {
    this.admin.assertAdminSession(req);
    const row = await this.rwaTokenAdmin.updateTokenAdmin(tokenId, {
      displayImageUrl: body.displayImageUrl,
      displayName: body.displayName,
      collectionKey: body.collectionKey,
    });
    return {
      tokenId,
      displayName: row.displayName,
      displayImageUrl: row.displayImageUrl,
      collectionKey: row.collectionKey,
    };
  }

  @ApiOperation({
    summary: '[Admin] Preview default image from on-chain metadata',
  })
  @ApiParam({ name: 'tokenId', example: 1 })
  @Post(':tokenId/preview-metadata-image')
  async previewMetadataImage(
    @Req() req: Request,
    @Param('tokenId', ParseIntPipe) tokenId: number,
    @Body() _body: AdminRwaTokenActionDto,
  ) {
    this.admin.assertAdminSession(req);
    return this.rwaTokenAdmin.previewImageRefFromMetadata(tokenId);
  }
}
