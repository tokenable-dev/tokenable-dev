import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { apiBodyDefault } from '../swagger/api-body.util';
import { SWAGGER_BODY_EXAMPLES } from '../swagger/examples';
import { SWAGGER_FIXTURES } from '../swagger/fixtures';
import { ApiChainIdHeader } from '../swagger/api-headers.util';
import { BlockchainService } from './blockchain.service';
import { CHAIN_ID_HEADER, ChainConfigService } from './chain-config.service';
import { RwaAssetResolveService } from './rwa-asset-resolve.service';
import { MediaResolveDto } from './dto/media-resolve.dto';
import { RwaMetadataBatchDto } from './dto/rwa-metadata-batch.dto';

/**
 * 온체인 RWA·미디어 조회 — IPFS는 서버에서만 해석 (브라우저 직접 fetch 금지).
 * Reads honor `x-tokenable-chain-id` so Sepolia inventory never leaks onto Polygon/Ethereum UI.
 */
@ApiTags('blockchain')
@Controller('blockchain')
export class BlockchainController {
  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly rwaAssetResolve: RwaAssetResolveService,
    private readonly chainConfig: ChainConfigService,
  ) {}

  /** tokenId → tokenURI + 메타데이터 + https 이미지 URL 일괄 */
  @ApiOperation({
    summary: 'RWA 자산 단건 (tokenURI·메타·이미지 URL)',
  })
  @ApiChainIdHeader()
  @ApiParam({ name: 'tokenId', description: 'RWA tokenId', example: 1 })
  @Get('rwa/asset/:tokenId')
  getResolvedRwaAsset(
    @Param('tokenId', ParseIntPipe) tokenId: number,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    const chainId = this.chainConfig.resolveChainId(chainHeader);
    return this.rwaAssetResolve.getResolvedRwaAsset(tokenId, chainId);
  }

  /** ERC-721 tokenURI 문자열만 */
  @ApiOperation({ summary: 'tokenURI 조회' })
  @ApiChainIdHeader()
  @ApiParam({ name: 'tokenId', description: 'RWA tokenId', example: 1 })
  @Get('rwa/token-uri/:tokenId')
  getRwaTokenURI(
    @Param('tokenId', ParseIntPipe) tokenId: number,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ): Promise<string> {
    const chainId = this.chainConfig.resolveChainId(chainHeader);
    return this.blockchainService.getRwaTokenURI(tokenId, chainId);
  }

  /** 지갑 주소로 보유 tokenId 배열 */
  @ApiOperation({ summary: '지갑별 보유 RWA tokenId 목록' })
  @ApiChainIdHeader()
  @ApiParam({ name: 'address', description: '지갑 주소', example: SWAGGER_FIXTURES.wallet })
  // Full-supply ownerOf scan behind this route — cached 30s in the service,
  // and per-IP capped so it can't be used to drain the RPC quota.
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get('rwa/tokens/:address')
  getRwaTokensByOwner(
    @Param('address') address: string,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ): Promise<number[]> {
    const chainId = this.chainConfig.resolveChainId(chainHeader);
    return this.blockchainService.getRwaTokensByOwner(address, chainId);
  }

  /** 여러 tokenId 메타·이미지 URL 배치 */
  @ApiOperation({
    summary: 'RWA 메타데이터 배치 (tokenURI·이미지 URL)',
  })
  @ApiChainIdHeader()
  @ApiBody(apiBodyDefault(RwaMetadataBatchDto, SWAGGER_BODY_EXAMPLES.rwaMetadataBatch))
  @Post('rwa/metadata/batch')
  batchRwaMetadata(
    @Body() body: RwaMetadataBatchDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    const chainId = this.chainConfig.resolveChainId(chainHeader);
    return this.rwaAssetResolve.batchRwaMetadata(body.tokenIds ?? [], chainId);
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
