import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class AdminAnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Rolling window for time-series and period counters',
    enum: [7, 30, 90],
    default: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([7, 30, 90])
  @Min(7)
  @Max(90)
  days?: number;
}
