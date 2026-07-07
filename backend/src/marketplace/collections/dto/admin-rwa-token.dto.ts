import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AdminRwaTokenListQueryDto {}

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

export class AdminRwaTokenActionDto {}

export class AdminDeliverRwaTokenDto {
  @ApiPropertyOptional({
    description:
      'Override delivery wallet. Must be linked to the vault depositor account. Defaults to primary linked wallet.',
    example: '0x1234567890123456789012345678901234567890',
  })
  @IsOptional()
  @IsString()
  recipientAddress?: string | null;
}
