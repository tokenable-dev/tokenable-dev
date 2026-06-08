import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

export class AdminSetCollectionCoverDto {
  @ApiProperty({ example: '0xD5abDD307414718C59949Ac5465930a1F8a52691' })
  @Matches(WALLET_RE, { message: '유효하지 않은 관리자 지갑 주소입니다' })
  adminWallet: string;

  @ApiProperty({
    description: 'HTTPS 또는 ipfs:// 커버 URL (marketplace_collections에 저장)',
    example: 'https://example.com/card.png',
  })
  @IsString()
  coverImageUrl: string;
}

export class AdminPreviewCollectionCoverFromTokenDto {
  @ApiProperty({ example: '0xD5abDD307414718C59949Ac5465930a1F8a52691' })
  @Matches(WALLET_RE, { message: '유효하지 않은 관리자 지갑 주소입니다' })
  adminWallet: string;

  @ApiProperty({ description: '메타데이터에서 카탈로그/커버를 찾을 RWA tokenId' })
  @IsString()
  tokenId: string;

  @ApiPropertyOptional({
    description: 'true면 조회한 URL을 컬렉션에 저장 (관리자 덮어쓰기)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  save?: boolean;
}

export class AdminDeleteCollectionDto {
  @ApiProperty({ example: '0xD5abDD307414718C59949Ac5465930a1F8a52691' })
  @Matches(WALLET_RE, { message: '유효하지 않은 관리자 지갑 주소입니다' })
  adminWallet: string;

  @ApiProperty({
    description: 'URL의 collection_key와 정확히 일치해야 함 (안전 확인)',
    example: '92f4ca15d7f928149efcce95cb55255496a610c45b71569d1b5c27f89a6ce43d',
  })
  @IsString()
  confirmCollectionKey: string;
}
