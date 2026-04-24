import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, Min } from 'class-validator';

export class MintPreviewsByTokenIdsDto {
  @ApiProperty({ type: [Number], maxItems: 32 })
  @IsArray()
  @ArrayMaxSize(32)
  @IsInt({ each: true })
  @Min(0, { each: true })
  tokenIds!: number[];
}
