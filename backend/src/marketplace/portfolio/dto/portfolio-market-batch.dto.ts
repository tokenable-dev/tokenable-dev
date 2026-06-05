import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { SWAGGER_BODY_EXAMPLES } from '../../../swagger/examples';

export class PortfolioMarketBatchDto {
  @ApiProperty({
    type: [String],
    example: SWAGGER_BODY_EXAMPLES.portfolioMarketBatch.collectionKeys,
  })
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  collectionKeys!: string[];

  @ApiPropertyOptional({
    enum: ['7d', '30d', '90d', '180d', '365d', 'max'],
    example: '365d',
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
