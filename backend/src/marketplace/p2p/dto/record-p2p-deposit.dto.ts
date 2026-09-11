import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEthereumAddress,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class RecordP2pDepositDto {
  @ApiProperty({ description: 'Buyer wallet that funded the escrow' })
  @IsEthereumAddress()
  buyerWallet!: string;

  @ApiPropertyOptional({
    description:
      'createAndDeposit tx hash (optional if escrow already funded and buyer is completing registration)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/)
  depositTxHash?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(256)
  shipToName?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  shipToLine1!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  shipToLine2?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  shipToCity!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  shipToRegion?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  shipToPostal!: string;

  @ApiProperty({ example: 'US' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(8)
  shipToCountry!: string;
}
