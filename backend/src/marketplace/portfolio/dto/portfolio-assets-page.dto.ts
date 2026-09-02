import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateIf,
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
    description:
      '페이지 단위 RWA tokenId 목록 (최대 50). 생략 시 서버가 DB owner index에서 보유 목록을 조회해 첫 페이지를 반환.',
    example: SWAGGER_FIXTURES.tokenIds,
    required: false,
  })
  @IsOptional()
  @ValidateIf((o: PortfolioAssetsPageDto) => Array.isArray(o.tokenIds) && o.tokenIds.length > 0)
  @IsArray()
  @ArrayMaxSize(PORTFOLIO_ASSETS_PAGE_MAX)
  @IsInt({ each: true })
  @Min(0, { each: true })
  tokenIds?: number[];
}
