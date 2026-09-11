import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, Min } from 'class-validator';
import { SWAGGER_BODY_EXAMPLES } from '../../../swagger/examples';

export class MintPreviewsByTokenIdsDto {
  @ApiProperty({
    type: [Number],
    maxItems: 32,
    description: 'Cardhedger 프리뷰를 조회할 RWA tokenId 목록 (최대 32)',
    example: SWAGGER_BODY_EXAMPLES.mintPreviews.tokenIds,
  })
  @IsArray()
  @ArrayMaxSize(32)
  @IsInt({ each: true })
  @Min(0, { each: true })
  tokenIds!: number[];
}
