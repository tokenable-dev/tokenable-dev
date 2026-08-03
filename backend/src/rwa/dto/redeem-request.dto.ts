import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
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

  @ApiProperty({ enum: ['us', 'ca', 'intl'], example: 'us' })
  @IsIn(['us', 'ca', 'intl'])
  country!: 'us' | 'ca' | 'intl';

  @ApiProperty({ example: '+1 555 000 0000' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  phone!: string;
}

export class RedeemRequestDto {
  @ApiProperty({ description: 'tokenId of the NFT to redeem', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tokenId!: number;

  @ApiPropertyOptional({ type: RedeemShipToDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RedeemShipToDto)
  shipTo?: RedeemShipToDto;
}
