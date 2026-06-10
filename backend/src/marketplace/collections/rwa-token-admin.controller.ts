import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
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
  @ApiQuery({ name: 'adminWallet', required: true })
  @Get('listings')
  async listListedCards(@Query() query: AdminRwaTokenListQueryDto) {
    this.admin.assertAdminWallet(query.adminWallet);
    return this.rwaTokenAdmin.listActiveListedCards();
  }

  @ApiOperation({ summary: '[Admin] Update RWA token registry fields' })
  @ApiParam({ name: 'tokenId', example: 1 })
  @Patch(':tokenId')
  async updateToken(
    @Param('tokenId', ParseIntPipe) tokenId: number,
    @Body() body: AdminUpdateRwaTokenDto,
  ) {
    this.admin.assertAdminWallet(body.adminWallet);
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
    @Param('tokenId', ParseIntPipe) tokenId: number,
    @Body() body: AdminRwaTokenActionDto,
  ) {
    this.admin.assertAdminWallet(body.adminWallet);
    return this.rwaTokenAdmin.previewImageRefFromMetadata(tokenId);
  }
}
