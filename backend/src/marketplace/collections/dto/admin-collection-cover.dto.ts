import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

export class AdminSetCollectionCoverDto {
  @ApiProperty({ example: '0xD5abDD307414718C59949Ac5465930a1F8a52691' })
  @Matches(WALLET_RE, { message: 'Invalid admin wallet address' })
  adminWallet: string;

  @ApiProperty({
    description: 'HTTPS or ipfs:// cover URL (persisted on marketplace_collections)',
    example: 'https://example.com/card.png',
  })
  @IsString()
  coverImageUrl: string;
}

export class AdminPreviewCollectionCoverFromTokenDto {
  @ApiProperty({ example: '0xD5abDD307414718C59949Ac5465930a1F8a52691' })
  @Matches(WALLET_RE, { message: 'Invalid admin wallet address' })
  adminWallet: string;

  @ApiProperty({ description: 'RWA token id to resolve catalog/cover from metadata' })
  @IsString()
  tokenId: string;

  @ApiPropertyOptional({
    description: 'When true, persist resolved URL on the collection (admin override)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  save?: boolean;
}

export class AdminDeleteCollectionDto {
  @ApiProperty({ example: '0xD5abDD307414718C59949Ac5465930a1F8a52691' })
  @Matches(WALLET_RE, { message: 'Invalid admin wallet address' })
  adminWallet: string;

  @ApiProperty({
    description:
      'Must exactly match the collection_key in the URL (safety check)',
    example: '92f4ca15d7f928149efcce95cb55255496a610c45b71569d1b5c27f89a6ce43d',
  })
  @IsString()
  confirmCollectionKey: string;
}
