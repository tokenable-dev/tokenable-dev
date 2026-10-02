import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class FedexProbeAddressDto {
  @ApiPropertyOptional({ example: 'Tokenable Ops' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  companyName?: string;

  @ApiPropertyOptional({ example: 'Ops Desk' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  contactName?: string;

  @ApiPropertyOptional({ example: '+1 213 555 0100' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiProperty({
    example: 'US',
    description: 'ISO-3166 alpha-2 (US/CA/KR/…)',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  country!: string;

  @ApiProperty({ example: 'Los Angeles' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  city!: string;

  @ApiPropertyOptional({
    example: 'CA',
    description: 'US/CA: 2-letter state/province only',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  region?: string;

  @ApiProperty({ example: '90015' })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  postal!: string;

  @ApiProperty({ example: '1 Main St' })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  line1!: string;

  @ApiPropertyOptional({ example: 'Suite 100' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  line2?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  residential?: boolean;
}

/** Admin Swagger probe for live FedEx Rates and Transit Times. */
export class FedexRateProbeDto {
  @ApiProperty({ type: FedexProbeAddressDto })
  @ValidateNested()
  @Type(() => FedexProbeAddressDto)
  origin!: FedexProbeAddressDto;

  @ApiProperty({ type: FedexProbeAddressDto })
  @ValidateNested()
  @Type(() => FedexProbeAddressDto)
  destination!: FedexProbeAddressDto;

  @ApiProperty({
    enum: ['us', 'ca', 'intl'],
    example: 'intl',
    description: 'Redeem country bucket (affects stub fallback amounts)',
  })
  @IsIn(['us', 'ca', 'intl'])
  destinationBucket!: 'us' | 'ca' | 'intl';

  @ApiPropertyOptional({
    example: 2,
    minimum: 1,
    maximum: 50,
    description: 'Card count → package weight',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  packageCount?: number;
}
