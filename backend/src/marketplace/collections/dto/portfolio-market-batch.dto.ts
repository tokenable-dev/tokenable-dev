import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class PortfolioMarketBatchHintDto {
  @ApiProperty({ description: 'marketplace collection_key' })
  @IsString()
  collectionKey!: string;

  @ApiProperty({
    description: 'Owned token id in that bucket (IPFS hint path)',
  })
  @IsInt()
  @Min(0)
  hintTokenId!: number;
}

export class PortfolioMarketBatchDto {
  @ApiProperty({
    type: [String],
    description: 'Distinct collection_key values (max 60)',
  })
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  collectionKeys!: string[];

  @ApiPropertyOptional({ enum: ['7d', '30d', '90d', '180d', '365d'] })
  @IsOptional()
  @IsIn(['7d', '30d', '90d', '180d', '365d'])
  priceHistoryDuration?: '7d' | '30d' | '90d' | '180d' | '365d';

  @ApiPropertyOptional({
    type: [PortfolioMarketBatchHintDto],
    description:
      'Optional hint token per key (same as GET …/market-series?hintTokenId=)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => PortfolioMarketBatchHintDto)
  hints?: PortfolioMarketBatchHintDto[];
}
