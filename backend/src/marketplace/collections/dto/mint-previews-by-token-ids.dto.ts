import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, Min } from 'class-validator';
import { SWAGGER_BODY_EXAMPLES } from '../../../swagger/examples';

export class MintPreviewsByTokenIdsDto {
  @ApiProperty({
    type: [Number],
    maxItems: 32,
    example: SWAGGER_BODY_EXAMPLES.mintPreviews.tokenIds,
  })
  @IsArray()
  @ArrayMaxSize(32)
  @IsInt({ each: true })
  @Min(0, { each: true })
  tokenIds!: number[];
}
