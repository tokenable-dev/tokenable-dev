import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Matches, Min } from 'class-validator';
import { SWAGGER_FIXTURES } from '../../../swagger/fixtures';

export class PortfolioHideHoldingDto {
  @ApiProperty({ example: SWAGGER_FIXTURES.wallet })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/)
  walletAddress!: string;

  @ApiProperty({ example: SWAGGER_FIXTURES.tokenId })
  @IsInt()
  @Min(0)
  tokenId!: number;
}
