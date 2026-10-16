import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, Min } from 'class-validator';

export class TokenCollectionKeysDto {
  @ApiProperty({
    type: [Number],
    description: 'marketplace collection_key로 변환할 RWA tokenId 목록 (최대 120)',
    example: [1, 2, 3],
  })
  @IsArray()
  @ArrayMaxSize(120)
  @IsInt({ each: true })
  @Min(0, { each: true })
  tokenIds!: number[];
}
