import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, Min } from 'class-validator';

export class OrdersBatchByTokenDto {
  @ApiProperty({ type: [Number], maxItems: 120 })
  @IsArray()
  @ArrayMaxSize(120)
  @IsInt({ each: true })
  @Min(0, { each: true })
  tokenIds!: number[];
}
