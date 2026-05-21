import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { BlockchainService } from './blockchain.service';
import { MediaResolveDto } from './dto/media-resolve.dto';
import { RwaMetadataBatchDto } from './dto/rwa-metadata-batch.dto';

@ApiTags('blockchain')
@Controller('blockchain')
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @ApiOperation({
    summary:
      'tokenURI + IPFS metadata + resolved https imageUrl (single server-side pipeline; browser must not fetch IPFS)',
  })
  @ApiParam({ name: 'tokenId', description: 'RWA Token ID', example: '0' })
  @Get('rwa/asset/:tokenId')
  getResolvedRwaAsset(@Param('tokenId', ParseIntPipe) tokenId: number) {
    return this.blockchainService.getResolvedRwaAsset(tokenId);
  }

  @ApiOperation({ summary: '특정 tokenId의 tokenURI 조회' })
  @ApiParam({ name: 'tokenId', description: 'RWA Token ID', example: '0' })
  @Get('rwa/token-uri/:tokenId')
  getRwaTokenURI(
    @Param('tokenId', ParseIntPipe) tokenId: number,
  ): Promise<string> {
    return this.blockchainService.getRwaTokenURI(tokenId);
  }

  @ApiOperation({ summary: '특정 지갑이 보유한 RWA tokenId 목록 조회' })
  @ApiParam({
    name: 'address',
    description: '지갑 주소 (0x...)',
    example: '0xD5abDD307414718C59949Ac5465930a1F8a52691',
  })
  @Get('rwa/tokens/:address')
  getRwaTokensByOwner(@Param('address') address: string): Promise<number[]> {
    return this.blockchainService.getRwaTokensByOwner(address);
  }

  @ApiOperation({
    summary:
      'Batch tokenURI + metadata + resolved imageUrl (server IPFS gateways + CID cache; no client IPFS)',
  })
  @ApiBody({
    type: RwaMetadataBatchDto,
    examples: {
      metadataBatch: {
        summary: 'Resolve metadata for many token ids',
        value: { tokenIds: [1, 2, 3, 1001] },
      },
    },
  })
  @Post('rwa/metadata/batch')
  batchRwaMetadata(@Body() body: RwaMetadataBatchDto) {
    return this.blockchainService.batchRwaMetadata(body.tokenIds ?? []);
  }

  @ApiOperation({
    summary:
      'Resolve ipfs:// or https /ipfs/… URIs to a browser-loadable https URL (server fallbacks + cache)',
  })
  @ApiBody({
    type: MediaResolveDto,
    examples: {
      mediaResolve: {
        summary: 'Resolve ipfs:// URIs to https URLs',
        value: {
          uris: [
            'ipfs://bafybeibxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/image.png',
            'https://gateway.pinata.cloud/ipfs/bafybeibyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
          ],
        },
      },
    },
  })
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
