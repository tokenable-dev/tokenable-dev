import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class VaultSubmissionCardDto {
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  cert!: string;

  @IsString()
  @MaxLength(512)
  name!: string;

  @IsInt()
  @Min(1)
  grade!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  img?: string | null;

  @IsBoolean()
  confirmed!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  cardNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  year?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  setName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  language?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  variant?: string | null;
}

export class UpsertVaultSubmissionDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  publicId?: string;

  /** Confirmed cards for the shipping package (≥1). Add-cards is local-only. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(99)
  @ValidateNested({ each: true })
  @Type(() => VaultSubmissionCardDto)
  cards!: VaultSubmissionCardDto[];
}

export class RegisterVaultShipmentDto {
  @IsIn(['fedex', 'dhl', 'ups'])
  carrier!: 'fedex' | 'dhl' | 'ups';

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9\s-]+$/)
  trackingNumber!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  shipDate?: string;
}
