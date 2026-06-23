import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AdminRwaTokenListQueryDto {}

export class AdminRwaTokenActionDto {}

export class AdminUpdateRwaTokenDto {
  @ApiPropertyOptional({
    description:
      'HTTPS 또는 ipfs:// URL. null 또는 빈 문자열이면 override 제거',
    example: 'https://example.com/slab-front.png',
  })
  @IsOptional()
  @IsString()
  displayImageUrl?: string | null;

  @ApiPropertyOptional({ description: '표시 이름 (rwa_tokens.display_name)' })
  @IsOptional()
  @IsString()
  displayName?: string | null;

  @ApiPropertyOptional({ description: 'marketplace collection_key' })
  @IsOptional()
  @IsString()
  collectionKey?: string | null;
}
