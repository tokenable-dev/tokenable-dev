import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { SUPPORTED_CHAIN_IDS } from '../../../blockchain/chain-config.service';

/** Checked against `MARKETPLACE_ADMIN_DB_RESET_PASSWORD`. */
export class AdminDataInventoryPruneChainResidueDto {
  @ApiProperty({
    description: 'Must match MARKETPLACE_ADMIN_DB_RESET_PASSWORD',
  })
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiProperty({
    description: 'Network whose orphan vault rows and legacy submissions to prune',
    example: 11155111,
    enum: SUPPORTED_CHAIN_IDS,
  })
  @IsInt()
  @IsIn(SUPPORTED_CHAIN_IDS)
  chainId!: (typeof SUPPORTED_CHAIN_IDS)[number];

  @ApiPropertyOptional({
    description:
      'When true, TRUNCATE vault_psa_arrival_reviews and vault_psa_vaulted_reviews (all networks).',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true' || value === 1)
  clearPsaMailReviews?: boolean;
}
