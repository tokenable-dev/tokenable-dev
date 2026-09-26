import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AddressAutocompleteQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionToken?: string;
}

export class AddressPlaceQueryDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(256)
  placeId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionToken?: string;
}

export class CreateShippingAddressDto {
  @ApiPropertyOptional({ example: 'Home' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  label?: string;

  @ApiProperty({ example: 'Daisy Kim' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name!: string;

  @ApiProperty({ example: '123 Market St' })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  line1!: string;

  @ApiPropertyOptional({ example: 'Apt 4' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  line2?: string;

  @ApiProperty({ example: 'San Francisco' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  city!: string;

  @ApiPropertyOptional({ example: 'CA' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  region?: string;

  @ApiProperty({ example: '94105' })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  postal!: string;

  @ApiProperty({ enum: ['us', 'ca', 'intl'], example: 'us' })
  @IsIn(['us', 'ca', 'intl'])
  country!: 'us' | 'ca' | 'intl';

  @ApiProperty({ example: '+1 555 000 0000' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  phone!: string;

  @ApiPropertyOptional({ description: 'Set as default shipping address' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateShippingAddressDto {
  @ApiPropertyOptional({ example: 'Office' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  line1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(256)
  line2?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  region?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  postal?: string;

  @ApiPropertyOptional({ enum: ['us', 'ca', 'intl'] })
  @IsOptional()
  @IsIn(['us', 'ca', 'intl'])
  country?: 'us' | 'ca' | 'intl';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
