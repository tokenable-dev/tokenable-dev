import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEthereumAddress,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateMarketplacePartnerDto {
  @ApiProperty({ example: 'Acme Collectibles' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  displayName!: string;

  @ApiProperty({
    description: 'Company wallet address (must match private key)',
    example: '0xAc5EBB0573Ca515741D8986a1bA1CDC178F46539',
  })
  @IsEthereumAddress()
  walletAddress!: string;

  @ApiProperty({
    description: 'Company wallet private key (write-only; never returned)',
    example: '0x…64 hex chars…',
  })
  @IsString()
  @MinLength(64)
  @MaxLength(66)
  privateKey!: string;

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
    description: 'Replace entrusted private key (write-only)',
  })
  @IsOptional()
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
