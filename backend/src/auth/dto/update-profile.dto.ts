import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

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
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Daisy Kim' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

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
}
