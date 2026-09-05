import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** ISO 3166-1 alpha-2; uppercase. */
const ISO2 = /^[A-Z]{2}$/;

export class UpsertMarketplacePartnerAddressDto {
  @ApiProperty({ example: 'Acme Collectibles LLC' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  companyName!: string;

  @ApiProperty({ example: 'Jordan Lee' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  contactName!: string;

  @ApiProperty({ example: '+1 555 010 0199' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  phone!: string;

  @ApiProperty({
    description: 'ISO 3166-1 alpha-2 (US, CA, KR, …)',
    example: 'US',
  })
  @IsString()
  @Matches(ISO2, { message: 'country must be ISO 3166-1 alpha-2 (e.g. US)' })
  country!: string;

  @ApiProperty({ example: 'Los Angeles' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  city!: string;

  @ApiPropertyOptional({
    description: 'State / province — required when country is US or CA (enforced in service)',
    example: 'CA',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  region?: string | null;

  @ApiProperty({ example: '90015' })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  postal!: string;

  @ApiProperty({ example: '1200 Figueroa St' })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  line1!: string;

  @ApiPropertyOptional({ example: 'Suite 400' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  line2?: string | null;

  @ApiPropertyOptional({
    description: 'FedEx residential flag (default false for vault origins)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  residential?: boolean;
}
