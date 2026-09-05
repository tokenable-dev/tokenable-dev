import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListMyRedemptionsQueryDto {
  /** Comma-separated tokenIds to filter (optional). */
  @ApiPropertyOptional({ example: '1,2,3' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  tokenIds?: string;
}
