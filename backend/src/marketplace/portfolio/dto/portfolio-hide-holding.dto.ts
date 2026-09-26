import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Matches, Min } from 'class-validator';
import { SWAGGER_FIXTURES } from '../../../swagger/fixtures';

export class PortfolioHideHoldingDto {
  @ApiProperty({ description: '지갑 주소', example: SWAGGER_FIXTURES.wallet })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/)
  walletAddress!: string;

  @ApiProperty({ description: '숨길 RWA tokenId', example: SWAGGER_FIXTURES.tokenId })
  @IsInt()
  @Min(0)
  tokenId!: number;
}
