import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AdminSetCollectionCoverDto {
  @ApiProperty({
    description: 'HTTPS 카탈로그 커버 URL (marketplace_collections에 저장; PSA cert slab / IPFS 불가)',
    example: 'https://images.pokemontcg.io/sv3pt5/199/large.png',
  })
  @IsString()
  coverImageUrl: string;
}

export class AdminPreviewCollectionCoverFromTokenDto {
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

  @ApiPropertyOptional({
    description:
      'true면 현재 cover보다 점수가 높을 때만 저장 (화질 업그레이드). save보다 우선.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  upgradeIfBetter?: boolean;
}

export class AdminDeleteCollectionDto {
  @ApiProperty({
    description: 'URL의 collection_key와 정확히 일치해야 함 (안전 확인)',
    example: '92f4ca15d7f928149efcce95cb55255496a610c45b71569d1b5c27f89a6ce43d',
  })
  @IsString()
  confirmCollectionKey: string;
}

export class AdminSetCollectionReviewStatusDto {
  @ApiProperty({
    description: 'Target review status',
    enum: ['pending_review', 'active', 'rejected'],
    example: 'active',
  })
  @IsString()
  reviewStatus: 'pending_review' | 'active' | 'rejected';
}
