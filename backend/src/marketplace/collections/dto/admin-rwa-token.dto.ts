import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, ValidateIf } from 'class-validator';

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

export class AdminRwaTokenListQueryDto {
  @ApiProperty({ example: '0xD5abDD307414718C59949Ac5465930a1F8a52691' })
  @Matches(WALLET_RE, { message: '유효하지 않은 관리자 지갑 주소입니다' })
  adminWallet: string;
}

export class AdminRwaTokenActionDto {
  @ApiProperty({ example: '0xD5abDD307414718C59949Ac5465930a1F8a52691' })
  @Matches(WALLET_RE, { message: '유효하지 않은 관리자 지갑 주소입니다' })
  adminWallet: string;
}

export class AdminUpdateRwaTokenDto {
  @ApiProperty({ example: '0xD5abDD307414718C59949Ac5465930a1F8a52691' })
  @Matches(WALLET_RE, { message: '유효하지 않은 관리자 지갑 주소입니다' })
  adminWallet: string;

  @ApiPropertyOptional({
    description:
      'HTTPS 또는 ipfs:// URL. null 또는 빈 문자열이면 override 제거',
    example: 'https://example.com/slab-front.png',
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
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
