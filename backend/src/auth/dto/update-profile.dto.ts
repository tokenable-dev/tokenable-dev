import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  canonicalizeLocale,
  SUPPORTED_DISPLAY_CURRENCIES,
  SUPPORTED_LOCALES,
} from '../../fx/supported-currencies';

export class EmailNotifPrefsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  trades?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  bids?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  price?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  vault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  listing?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  market?: boolean;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Daisy Kim' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  /** Contact inbox for wallet-only (MetaMask) accounts that still have `@privy.wallet`. */
  @ApiPropertyOptional({ example: 'collector@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  marketingEmailsOptIn?: boolean;

  @ApiPropertyOptional({
    description: 'Master switch for category email notification prefs',
  })
  @IsOptional()
  @IsBoolean()
  emailNotificationsEnabled?: boolean;

  @ApiPropertyOptional({ type: EmailNotifPrefsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => EmailNotifPrefsDto)
  emailNotifPrefs?: EmailNotifPrefsDto;

  /** `en`, `zh-CN`, `ja`, `zh-TW`. Case variants are stored in canonical form. */
  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? (canonicalizeLocale(value) ?? value) : value,
  )
  @IsIn(SUPPORTED_LOCALES)
  preferredLocale?: (typeof SUPPORTED_LOCALES)[number];

  @ApiPropertyOptional({ enum: SUPPORTED_DISPLAY_CURRENCIES })
  @IsOptional()
  @IsIn(SUPPORTED_DISPLAY_CURRENCIES)
  preferredCurrency?: (typeof SUPPORTED_DISPLAY_CURRENCIES)[number];
}
