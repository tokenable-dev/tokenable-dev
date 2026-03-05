import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { BlockchainService, MarketplaceListing } from './blockchain.service';

@ApiTags('blockchain')
@Controller('blockchain')
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  // ── USDC ────────────────────────────────────────────
  @ApiOperation({ summary: 'USDC 토큰 정보 조회 (이름, 심볼, 소수점)' })
  @Get('token/info')
  getTokenInfo(): Promise<{ name: string; symbol: string; decimals: number }> {
    return this.blockchainService.getTokenInfo();
  }

  @ApiOperation({ summary: 'USDC 총 발행량 조회' })
  @Get('token/supply')
  getTotalSupply(): Promise<string> {
    return this.blockchainService.getTotalSupply();
  }

  @ApiOperation({ summary: '특정 지갑의 USDC 잔액 조회' })
  @ApiParam({
    name: 'address',
    description: '지갑 주소 (0x...)',
    example: '0xD5abDD307414718C59949Ac5465930a1F8a52691',
  })
  @Get('token/balance/:address')
  getTokenBalance(@Param('address') address: string): Promise<string> {
    return this.blockchainService.getTokenBalance(address);
  }

  // ── SkyNFT ───────────────────────────────────────────
  @ApiOperation({
    summary: 'SkyNFT 컨트랙트 정보 조회 (이름, 심볼, 총 민팅 수)',
  })
  @Get('nft/info')
  getNftInfo(): Promise<{ name: string; symbol: string; totalMinted: number }> {
    return this.blockchainService.getNftInfo();
  }

  @ApiOperation({ summary: '특정 tokenId의 소유자 주소 조회' })
  @ApiParam({ name: 'tokenId', description: 'NFT Token ID', example: '0' })
  @Get('nft/owner/:tokenId')
  getNftOwner(
    @Param('tokenId', ParseIntPipe) tokenId: number,
  ): Promise<string> {
    return this.blockchainService.getNftOwner(tokenId);
  }

  @ApiOperation({ summary: '특정 tokenId의 tokenURI 조회' })
  @ApiParam({ name: 'tokenId', description: 'NFT Token ID', example: '0' })
  @Get('nft/token-uri/:tokenId')
  getNftTokenURI(
    @Param('tokenId', ParseIntPipe) tokenId: number,
  ): Promise<string> {
    return this.blockchainService.getNftTokenURI(tokenId);
  }

  @ApiOperation({ summary: '특정 지갑이 보유한 NFT 수량 조회' })
  @ApiParam({
    name: 'address',
    description: '지갑 주소 (0x...)',
    example: '0xD5abDD307414718C59949Ac5465930a1F8a52691',
  })
  @Get('nft/balance/:address')
  getNftBalance(@Param('address') address: string): Promise<number> {
    return this.blockchainService.getNftBalance(address);
  }

  @ApiOperation({ summary: '특정 지갑이 보유한 NFT tokenId 목록 조회' })
  @ApiParam({
    name: 'address',
    description: '지갑 주소 (0x...)',
    example: '0xD5abDD307414718C59949Ac5465930a1F8a52691',
  })
  @Get('nft/tokens/:address')
  getNftTokensByOwner(@Param('address') address: string): Promise<number[]> {
    return this.blockchainService.getNftTokensByOwner(address);
  }

  // ── Marketplace ──────────────────────────────────────
  @ApiOperation({ summary: '활성 마켓플레이스 판매 목록 전체 조회' })
  @Get('marketplace/listings')
  getMarketplaceListings(): Promise<MarketplaceListing[]> {
    return this.blockchainService.getMarketplaceListings();
  }

  @ApiOperation({ summary: '특정 tokenId의 마켓플레이스 판매 정보 조회' })
  @ApiParam({ name: 'tokenId', description: 'NFT Token ID', example: '0' })
  @Get('marketplace/listing/:tokenId')
  getMarketplaceListing(
    @Param('tokenId', ParseIntPipe) tokenId: number,
  ): Promise<MarketplaceListing> {
    return this.blockchainService.getMarketplaceListing(tokenId);
  }
}
