import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { SWAGGER_BODY_EXAMPLES } from '../../../swagger/examples';

export class BatchMarketSnapshotsDto {
  @ApiProperty({
    type: [String],
    description: '시장 스냅샷을 조회할 collection_key 목록 (최대 60)',
    example: SWAGGER_BODY_EXAMPLES.batchMarketSnapshots.collectionKeys,
  })
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  collectionKeys!: string[];

  @ApiPropertyOptional({
    description: '가격 이력 기간',
    enum: ['7d', '30d', '90d', '180d', '365d', 'max'],
    example: '90d',
  })
  @IsOptional()
  @IsIn(['7d', '30d', '90d', '180d', '365d', 'max'])
  priceHistoryDuration?:
    | '7d'
    | '30d'
    | '90d'
    | '180d'
    | '365d'
    | 'max';
}
