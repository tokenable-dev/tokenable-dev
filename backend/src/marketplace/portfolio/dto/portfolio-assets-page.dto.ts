import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { SWAGGER_FIXTURES } from '../../../swagger/fixtures';

/** Matches frontend `PORTFOLIO_ASSETS_PAGE_SIZE`. */
export const PORTFOLIO_ASSETS_PAGE_MAX = 50;

export class PortfolioAssetsPageDto {
  @ApiProperty({ description: '지갑 주소', example: SWAGGER_FIXTURES.wallet })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/)
  walletAddress!: string;

  @ApiProperty({
    description: '페이지 단위 RWA tokenId 목록 (최대 50)',
    example: SWAGGER_FIXTURES.tokenIds,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(PORTFOLIO_ASSETS_PAGE_MAX)
  @IsInt({ each: true })
  @Min(0, { each: true })
  tokenIds!: number[];
}
