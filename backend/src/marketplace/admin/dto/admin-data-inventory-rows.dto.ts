import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

/** Safe public table name: lowercase snake_case only. */
export class AdminDataInventoryTableParamDto {
  @ApiPropertyOptional({ example: 'rwa_tokens' })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/)
  table!: string;
}

export class AdminDataInventoryRowsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 50;

  /** Schema-map peek: skip exact COUNT(*), truncate wide JSON. */
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  compact?: boolean = false;
}
