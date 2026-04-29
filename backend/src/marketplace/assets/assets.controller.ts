import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { HiddenAssetsService } from './hidden-assets.service';

@ApiTags('marketplace')
@Controller('marketplace')
export class AssetsController {
  constructor(private readonly hiddenAssetsService: HiddenAssetsService) {}

  @ApiOperation({ summary: 'My Assets: list hidden tokenIds for a wallet' })
  @ApiQuery({ name: 'walletAddress', required: true })
  @Get('my-assets/hidden')
  listHiddenAssetTokenIds(@Query('walletAddress') walletAddress?: string) {
    const w = walletAddress?.trim() ?? '';
    if (!w) throw new BadRequestException('walletAddress is required');
    return this.hiddenAssetsService.listTokenIds(w).then((tokenIds) => ({ tokenIds }));
  }

  @ApiOperation({ summary: 'My Assets: hide token from portfolio view' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['walletAddress', 'tokenId'],
      properties: {
        walletAddress: { type: 'string' },
        tokenId: { type: 'number' },
      },
    },
  })
  @Post('my-assets/hidden')
  hideAsset(@Body() body: { walletAddress?: string; tokenId?: number }) {
    const w = body.walletAddress?.trim() ?? '';
    const tokenId = Number(body.tokenId);
    if (!w) throw new BadRequestException('walletAddress is required');
    if (!Number.isFinite(tokenId) || tokenId < 0) {
      throw new BadRequestException('tokenId must be a non-negative number');
    }
    return this.hiddenAssetsService.hide(w, tokenId);
  }

  @ApiOperation({ summary: 'My Assets: unhide token from portfolio view' })
  @ApiQuery({ name: 'walletAddress', required: true })
  @ApiQuery({ name: 'tokenId', required: true })
  @Patch('my-assets/hidden')
  unhideAsset(
    @Query('walletAddress') walletAddress?: string,
    @Query('tokenId') tokenIdRaw?: string,
  ) {
    const w = walletAddress?.trim() ?? '';
    const tokenId = Number(tokenIdRaw);
    if (!w) throw new BadRequestException('walletAddress is required');
    if (!Number.isFinite(tokenId) || tokenId < 0) {
      throw new BadRequestException('tokenId must be a non-negative number');
    }
    return this.hiddenAssetsService.unhide(w, tokenId);
  }
}
