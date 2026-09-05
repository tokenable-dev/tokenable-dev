import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEthereumAddress,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateMarketplacePartnerDto {
  @ApiProperty({ example: 'Acme Collectibles' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  displayName!: string;

  @ApiProperty({
    description: 'Company wallet (self-vault eligibility + bulk-mint offerer)',
    example: '0xAc5EBB0573Ca515741D8986a1bA1CDC178F46539',
  })
  @IsEthereumAddress()
  walletAddress!: string;

  @ApiPropertyOptional({
    description:
      'Optional entrusted private key for partner bulk mint+list. Write-only; never returned. Must match walletAddress when set.',
    example: '0x…64 hex chars…',
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsString()
  @MinLength(64)
  @MaxLength(66)
  privateKey?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMarketplacePartnerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  displayName?: string;

  @ApiPropertyOptional({
    description: 'Replace or add entrusted private key (write-only)',
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsString()
  @MinLength(64)
  @MaxLength(66)
  privateKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class MarketplacePartnerIdParamDto {
  @IsUUID()
  id!: string;
}
