import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsString, Matches, Min } from 'class-validator';
import { SWAGGER_FIXTURES } from '../../../swagger/fixtures';

export class PortfolioHoldingsBatchDto {
  @ApiProperty({ description: '지갑 주소', example: SWAGGER_FIXTURES.wallet })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/)
  walletAddress!: string;

  @ApiProperty({
    description: '조회할 RWA tokenId 목록',
    example: SWAGGER_FIXTURES.tokenIds,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @Min(0, { each: true })
  tokenIds!: number[];
}
