import {
  IsEthereumAddress,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** PSA / ops path: mint to custody, admin delivers. Self vault: mint straight to user. */
export type MintDeliveryMode = 'custody' | 'direct';

export class MintRwaDto {
  @ApiProperty({ description: 'Recipient wallet address (must be linked to the user account)' })
  @IsEthereumAddress()
  recipientAddress!: string;

  @ApiProperty({ description: 'IPFS metadata URI returned by POST /rwa/upload' })
  @IsString()
  @IsNotEmpty()
  tokenURI!: string;

  /**
   * PSA cert number of the physical card being deposited. This is the
   * permanent identity of the physical asset — it is what the on-chain
   * vaultRef (keccak256(certNumber)) is derived from, and MUST stay stable
   * across multiple vault deposit/redeem cycles of the same card so the
   * contract's anti-double-claim check works correctly. Mandatory: minting
   * always represents a specific verified vault deposit under this lifecycle.
   */
  @ApiProperty({
    description:
      'PSA cert number of the physical card (permanent physical-asset identity). Used to derive the immutable on-chain vaultRef and to open/continue this asset\'s vault cycle.',
    example: '83179580',
  })
  @IsString()
  @IsNotEmpty()
  certNumber!: string;

  @ApiPropertyOptional({
    enum: ['custody', 'direct'],
    default: 'custody',
    description:
      'custody (default): mint to platform custody; admin delivers. direct: mint to recipientAddress (self vault — no admin deliver).',
  })
  @IsOptional()
  @IsIn(['custody', 'direct'])
  deliveryMode?: MintDeliveryMode;

  /**
   * Optional S3 slab URL from POST /rwa/upload — stored on rwa_tokens when it
   * matches the platform key for this cert + chain. Ignored if invalid.
   */
  @ApiPropertyOptional({
    description:
      'Platform S3 slab URL from upload response (validated server-side)',
  })
  @IsOptional()
  @IsString()
  displayImageUrl?: string;

  @ApiPropertyOptional({
    description:
      'Platform S3 slab-back URL from upload response (validated server-side)',
  })
  @IsOptional()
  @IsString()
  displayImageBackUrl?: string;

  /**
   * List title for My Assets — stored on rwa_tokens.display_name at mint.
   * Prefer the same name used in upload metadata (`name` field).
   */
  @ApiPropertyOptional({
    description: 'Display name for portfolio list (rwa_tokens.display_name)',
    example: '2020 Panini Prizm Joe Burrow #307',
  })
  @IsOptional()
  @IsString()
  displayName?: string;

  /**
   * From POST /rwa/upload `collectionKey` — stored on rwa_tokens for snapshot
   * price joins without waiting for on-mint IPFS sync.
   */
  @ApiPropertyOptional({
    description: 'Marketplace collection_key (64-char hex) from upload',
    example: 'a1b2c3d4e5f6…',
  })
  @IsOptional()
  @IsString()
  collectionKey?: string;
}
