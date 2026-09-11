import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
import { Type } from 'class-transformer';

export class RedeemShipToDto {
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

  @ApiProperty({
    enum: ['us', 'ca', 'intl'],
    example: 'us',
    description:
      'Fee-schedule bucket (PSA shipping + stubs). Not used as FedEx country — see countryCode.',
  })
  @IsIn(['us', 'ca', 'intl'])
  country!: 'us' | 'ca' | 'intl';

  @ApiPropertyOptional({
    example: 'KR',
    description:
      'ISO-3166 alpha-2 destination for FedEx Rate. Required when country is intl or Partner Self vault tokens are quoted. us/ca map to US/CA when omitted.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  countryCode?: string;

  @ApiProperty({ example: '+1 555 000 0000' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  phone!: string;
}

/** Pay-once multi-card redeem after USDC transfer to PLATFORM_FEE_RECIPIENT. */
export class RedeemBatchRequestDto {
  @ApiProperty({ type: [Number], example: [1, 2] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  tokenIds!: number[];

  @ApiProperty({ type: RedeemShipToDto })
  @ValidateNested()
  @Type(() => RedeemShipToDto)
  shipTo!: RedeemShipToDto;

  @ApiProperty({
    description: 'USDC ERC-20 transfer tx hash paying the estimated total',
    example: '0xabc…',
  })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/)
  paymentTxHash!: string;
}

export class RedeemCustodyTransferDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tokenId!: number;

  @ApiProperty({
    description: 'User-signed ERC-721 safeTransferFrom tx into custody',
    example: '0xabc…',
  })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/)
  txHash!: string;
}

/** Confirm user-signed NFT → custody transfers for a paid redeem batch. */
export class RedeemBatchCustodyDto {
  @ApiProperty({
    type: [RedeemCustodyTransferDto],
    description:
      'New safeTransferFrom receipts. May be empty when every outstanding NFT is already owned by custody on-chain.',
  })
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RedeemCustodyTransferDto)
  transfers!: RedeemCustodyTransferDto[];
}
