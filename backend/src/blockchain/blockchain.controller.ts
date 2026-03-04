import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { BlockchainService } from './blockchain.service';

@ApiTags('blockchain')
@Controller('blockchain')
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @ApiOperation({ summary: 'SKY 토큰 정보 조회 (이름, 심볼, 소수점)' })
  @Get('token/info')
  getTokenInfo(): Promise<{ name: string; symbol: string; decimals: number }> {
    return this.blockchainService.getTokenInfo();
  }

  @ApiOperation({ summary: 'SKY 토큰 총 발행량 조회' })
  @Get('token/supply')
  getTotalSupply(): Promise<string> {
    return this.blockchainService.getTotalSupply();
  }

  @ApiOperation({ summary: '특정 지갑 주소의 SKY 토큰 잔액 조회' })
  @ApiParam({
    name: 'address',
    description: '지갑 주소 (0x...)',
    example: '0xD5abDD307414718C59949Ac5465930a1F8a52691',
  })
  @Get('token/balance/:address')
  getBalance(@Param('address') address: string): Promise<string> {
    return this.blockchainService.getBalance(address);
  }
}
