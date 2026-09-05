import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, Min } from 'class-validator';
import { SWAGGER_FIXTURES } from '../../../swagger/fixtures';

export class OrdersBatchByTokenDto {
  @ApiProperty({
    type: [Number],
    maxItems: 120,
    description: '주문 이력을 조회할 tokenId 목록 (최대 120)',
    example: SWAGGER_FIXTURES.tokenIds,
  })
  @IsArray()
  @ArrayMaxSize(120)
  @IsInt({ each: true })
  @Min(0, { each: true })
  tokenIds!: number[];
}
