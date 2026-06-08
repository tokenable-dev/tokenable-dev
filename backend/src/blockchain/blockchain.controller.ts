import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { apiBodyDefault } from '../swagger/api-body.util';
import { SWAGGER_BODY_EXAMPLES } from '../swagger/examples';
import { SWAGGER_FIXTURES } from '../swagger/fixtures';
import { BlockchainService } from './blockchain.service';
import { MediaResolveDto } from './dto/media-resolve.dto';
import { RwaMetadataBatchDto } from './dto/rwa-metadata-batch.dto';

/**
 * 온체인 RWA·미디어 조회 — IPFS는 서버에서만 해석 (브라우저 직접 fetch 금지).
 */
@ApiTags('blockchain')
@Controller('blockchain')
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  /** tokenId → tokenURI + 메타데이터 + https 이미지 URL 일괄 */
  @ApiOperation({
    summary: 'RWA 자산 단건 (tokenURI·메타·이미지 URL)',
  })
  @ApiParam({ name: 'tokenId', description: 'RWA tokenId', example: 1 })
  @Get('rwa/asset/:tokenId')
  getResolvedRwaAsset(@Param('tokenId', ParseIntPipe) tokenId: number) {
    return this.blockchainService.getResolvedRwaAsset(tokenId);
  }

  /** ERC-721 tokenURI 문자열만 */
  @ApiOperation({ summary: 'tokenURI 조회' })
  @ApiParam({ name: 'tokenId', description: 'RWA tokenId', example: 1 })
  @Get('rwa/token-uri/:tokenId')
  getRwaTokenURI(
    @Param('tokenId', ParseIntPipe) tokenId: number,
  ): Promise<string> {
    return this.blockchainService.getRwaTokenURI(tokenId);
  }

  /** 지갑 주소로 보유 tokenId 배열 */
  @ApiOperation({ summary: '지갑별 보유 RWA tokenId 목록' })
  @ApiParam({ name: 'address', description: '지갑 주소', example: SWAGGER_FIXTURES.wallet })
  @Get('rwa/tokens/:address')
  getRwaTokensByOwner(@Param('address') address: string): Promise<number[]> {
    return this.blockchainService.getRwaTokensByOwner(address);
  }

  /** 여러 tokenId 메타·이미지 URL 배치 */
  @ApiOperation({
    summary: 'RWA 메타데이터 배치 (tokenURI·이미지 URL)',
  })
  @ApiBody(apiBodyDefault(RwaMetadataBatchDto, SWAGGER_BODY_EXAMPLES.rwaMetadataBatch))
  @Post('rwa/metadata/batch')
  batchRwaMetadata(@Body() body: RwaMetadataBatchDto) {
    return this.blockchainService.batchRwaMetadata(body.tokenIds ?? []);
  }

  /** ipfs:// URI → 브라우저용 https URL */
  @ApiOperation({
    summary: '미디어 URI → https URL 변환',
  })
  @ApiBody(apiBodyDefault(MediaResolveDto, SWAGGER_BODY_EXAMPLES.mediaResolve))
  @Post('media/resolve')
  async resolveMediaUrls(@Body() body: MediaResolveDto) {
    const uris = body.uris ?? [];
    const items = await Promise.all(
      uris.map(async (uri) => ({
        uri,
        httpsUrl: await this.blockchainService.resolveMediaUrl(uri),
      })),
    );
    return { items };
  }
}
