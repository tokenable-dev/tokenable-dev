import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { BULK_MINT_MAX_ITEMS } from '../bulk-mint/bulk-mint-cert-list.util';

export class BulkMintItemInputDto {
  @ApiProperty({ example: '83179580' })
  @IsString()
  @MinLength(7)
  @MaxLength(16)
  certNumber!: string;

  @ApiProperty({ example: '1250.00', description: 'List price in USDC (human units)' })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  price!: string;
}

export class CreateBulkMintJobDto {
  @ApiProperty({
    description: 'Registered consignment partner (company wallet)',
    format: 'uuid',
  })
  @IsUUID()
  partnerId!: string;

  @ApiPropertyOptional({
    description: `Cert + price rows (max ${BULK_MINT_MAX_ITEMS}). Prefer this or a CSV/Excel upload.`,
    type: [BulkMintItemInputDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_MINT_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => BulkMintItemInputDto)
  items?: BulkMintItemInputDto[];

  @ApiPropertyOptional({
    description:
      'Raw CSV / newline text with certNumber,price columns (alternative to items / file)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  csvText?: string;
}
