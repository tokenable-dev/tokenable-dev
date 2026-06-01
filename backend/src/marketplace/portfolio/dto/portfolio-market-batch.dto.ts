import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

export class PortfolioMarketBatchDto {
  @ApiProperty({
    type: [String],
    description: 'Distinct collection_key values (max 60)',
  })
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  collectionKeys!: string[];

  @ApiPropertyOptional({ enum: ['7d', '30d', '90d', '180d', '365d', 'max'] })
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
