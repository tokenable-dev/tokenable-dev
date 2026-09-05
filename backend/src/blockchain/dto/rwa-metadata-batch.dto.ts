import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, Min } from 'class-validator';
import { SWAGGER_FIXTURES } from '../../swagger/fixtures';

export class RwaMetadataBatchDto {
  @ApiProperty({
    type: [Number],
    maxItems: 80,
    description: '메타데이터를 조회할 RWA tokenId 목록 (최대 80)',
    example: SWAGGER_FIXTURES.tokenIds,
  })
  @IsArray()
  @ArrayMaxSize(80)
  @IsInt({ each: true })
  @Min(0, { each: true })
  tokenIds!: number[];
}
