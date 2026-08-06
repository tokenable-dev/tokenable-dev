import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class RedeemEstimateQueryDto {
  @ApiProperty({ enum: ['us', 'ca', 'intl'], example: 'us' })
  @IsIn(['us', 'ca', 'intl'])
  country!: 'us' | 'ca' | 'intl';

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  cardCount?: number;

  /**
   * Optional comma-separated tokenIds for early-withdrawal calc via
   * vault_cycles.deposited_at. When omitted, ages are unknown → early fee
   * charged conservatively for every card.
   */
  @ApiPropertyOptional({
    example: '12,34',
    description: 'Comma-separated on-chain tokenIds',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(\d+)(,\d+)*$/, {
    message: 'tokenIds must be comma-separated positive integers',
  })
  tokenIds?: string;
}
