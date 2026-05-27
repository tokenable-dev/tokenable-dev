import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, Min } from 'class-validator';

export class TokenCollectionKeysDto {
  @ApiProperty({
    type: [Number],
    description: 'RWA token IDs to resolve into marketplace collection_key (max 120)',
    example: [1, 2, 3],
  })
  @IsArray()
  @ArrayMaxSize(120)
  @IsInt({ each: true })
  @Min(0, { each: true })
  tokenIds!: number[];
}
