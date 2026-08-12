import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Equals,
  IsBoolean,
  IsEthereumAddress,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateP2pListingDto {
  @ApiProperty({ example: '83179580' })
  @IsString()
  @IsNotEmpty()
  certNumber!: string;

  @ApiProperty({ description: 'IPFS metadata URI from POST /rwa/upload' })
  @IsString()
  @IsNotEmpty()
  tokenURI!: string;

  @ApiProperty({
    description: 'Listing price in USDC atomic units (6 decimals)',
    example: '100000000',
  })
  @IsString()
  @Matches(/^[1-9]\d*$/, { message: 'priceUsdc must be a positive integer string' })
  priceUsdc!: string;

  @ApiProperty({
    description: 'Seller payout wallet (must be linked to the account)',
  })
  @IsEthereumAddress()
  sellerWallet!: string;

  @ApiProperty({
    description: 'Must be true — seller accepts authenticity liability',
  })
  @IsBoolean()
  @Equals(true, { message: 'authenticityAccepted must be true' })
  authenticityAccepted!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description:
      'Platform S3 slab URL from POST /rwa/upload (preferred over imageUrl for display_image_url)',
  })
  @IsOptional()
  @IsString()
  displayImageUrl?: string;
}
