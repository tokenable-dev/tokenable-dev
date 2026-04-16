import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Allow,
  ArrayMaxSize,
  IsArray,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BatchMintPoketracePreviewItemDto {
  @ApiProperty({ description: 'RWA token id' })
  @IsInt()
  @Min(0)
  tokenId!: number;

  @ApiPropertyOptional({
    description: 'IPFS JSON metadata (same shape as client-side fetchIpfsMetadata)',
  })
  @Allow()
  metadata?: unknown;
}

export class BatchMintPoketracePreviewsDto {
  @ApiProperty({ type: [BatchMintPoketracePreviewItemDto] })
  @IsArray()
  @ArrayMaxSize(32)
  @ValidateNested({ each: true })
  @Type(() => BatchMintPoketracePreviewItemDto)
  items!: BatchMintPoketracePreviewItemDto[];
}
