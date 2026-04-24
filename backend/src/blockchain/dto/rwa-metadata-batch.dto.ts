import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, Min } from 'class-validator';

export class RwaMetadataBatchDto {
  @ApiProperty({ type: [Number], maxItems: 80 })
  @IsArray()
  @ArrayMaxSize(80)
  @IsInt({ each: true })
  @Min(0, { each: true })
  tokenIds!: number[];
}
