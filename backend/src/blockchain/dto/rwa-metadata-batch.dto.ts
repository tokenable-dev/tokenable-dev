import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEthereumAddress,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import { SWAGGER_FIXTURES } from '../../swagger/fixtures';

export class RwaMetadataBatchDto {
  @ApiProperty({
    type: [Number],
    maxItems: 80,
    description: '메타데이터를 조회할 RWA tokenId 목록 (최대 80)',
    example: SWAGGER_FIXTURES.tokenIds,
  })
  @IsArray()
  @ArrayMaxSize(80)
  @IsInt({ each: true })
  @Min(0, { each: true })
  tokenIds!: number[];

  /** When set, tokens owned by this wallet return full cert metadata; others are redacted. */
  @ApiPropertyOptional({
    description: 'Viewer wallet — full cert for owned tokenIds only',
    example: SWAGGER_FIXTURES.wallet,
  })
  @IsOptional()
  @IsEthereumAddress()
  viewerWalletAddress?: string;
}
