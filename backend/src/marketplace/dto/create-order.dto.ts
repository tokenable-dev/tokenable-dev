import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEthereumAddress,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsObject,
  IsString,
  ValidateNested,
} from 'class-validator';

class SeaportOfferItemDto {
  @ApiProperty({ description: 'ItemType (2 = ERC721)', example: 2 })
  @IsNumber()
  itemType: number;

  @ApiProperty({ description: 'NFT 컨트랙트 주소' })
  @IsString()
  token: string;

  @ApiProperty({ description: 'Token ID', example: '0' })
  @IsString()
  identifierOrCriteria: string;

  @ApiProperty({ example: '1' })
  @IsString()
  startAmount: string;

  @ApiProperty({ example: '1' })
  @IsString()
  endAmount: string;
}

class SeaportConsiderationItemDto {
  @ApiProperty({ description: 'ItemType (0 = ETH, 1 = ERC20)', example: 1 })
  @IsNumber()
  itemType: number;

  @ApiProperty({ description: '결제 토큰 주소 (USDC)' })
  @IsString()
  token: string;

  @ApiProperty({ example: '0' })
  @IsString()
  identifierOrCriteria: string;

  @ApiProperty({ description: '금액 (wei)', example: '1000000' })
  @IsString()
  startAmount: string;

  @ApiProperty({ description: '금액 (wei)', example: '1000000' })
  @IsString()
  endAmount: string;

  @ApiProperty({ description: '수령인 주소 (판매자)' })
  @IsString()
  recipient: string;
}

class SeaportOrderParametersDto {
  @ApiProperty()
  @IsString()
  offerer: string;

  @ApiProperty()
  @IsString()
  zone: string;

  @ApiProperty()
  @IsString()
  zoneHash: string;

  @ApiProperty()
  @IsString()
  startTime: string;

  @ApiProperty()
  @IsString()
  endTime: string;

  @ApiProperty()
  @IsNumber()
  orderType: number;

  @ApiProperty({ type: [SeaportOfferItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeaportOfferItemDto)
  offer: SeaportOfferItemDto[];

  @ApiProperty({ type: [SeaportConsiderationItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeaportConsiderationItemDto)
  consideration: SeaportConsiderationItemDto[];

  @ApiProperty()
  @IsNumber()
  totalOriginalConsiderationItems: number;

  @ApiProperty()
  @IsString()
  salt: string;

  @ApiProperty()
  @IsString()
  conduitKey: string;

  @ApiProperty()
  @IsString()
  counter: string;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'Seaport order parameters' })
  @IsObject()
  @ValidateNested()
  @Type(() => SeaportOrderParametersDto)
  parameters: SeaportOrderParametersDto;

  @ApiProperty({ description: 'EIP-712 서명', example: '0xabc...' })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiProperty({
    description: 'NFT 컨트랙트 주소',
    example: '0x9C60c8Ab73Cbd650A4135f1AC3C8340A0Cff91aE',
  })
  @IsEthereumAddress()
  tokenContract: string;

  @ApiProperty({ description: 'NFT Token ID', example: '0' })
  @IsNumberString()
  tokenId: string;

  @ApiProperty({
    description: '결제 토큰 주소 (USDC)',
    example: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  })
  @IsEthereumAddress()
  considerationToken: string;

  @ApiProperty({ description: '결제 금액 (wei)', example: '1000000' })
  @IsNumberString()
  considerationAmount: string;
}
