import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { SWAGGER_FIXTURES } from '../../../swagger/fixtures';
import {
  IsArray,
  IsEthereumAddress,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class SeaportOfferItemDto {
  @ApiProperty({ description: 'ItemType (1=ERC20, 2=ERC721)', example: 1 })
  @IsNumber()
  itemType: number;

  @ApiProperty({ example: SWAGGER_FIXTURES.rwaContract })
  @IsString()
  token: string;

  @ApiProperty({ example: '0' })
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
  @ApiProperty({
    description: 'ItemType (1=ERC20, 2=ERC721, 4=ERC721_WITH_CRITERIA)',
    example: 1,
  })
  @IsNumber()
  itemType: number;

  @ApiProperty({ example: SWAGGER_FIXTURES.usdc })
  @IsString()
  token: string;

  @ApiProperty({ example: '0' })
  @IsString()
  identifierOrCriteria: string;

  @ApiProperty({ example: '150000000' })
  @IsString()
  startAmount: string;

  @ApiProperty({ example: '150000000' })
  @IsString()
  endAmount: string;

  @ApiProperty({ example: SWAGGER_FIXTURES.wallet })
  @IsString()
  recipient: string;
}

class SeaportOrderParametersDto {
  @ApiProperty({ example: SWAGGER_FIXTURES.wallet })
  @IsString()
  offerer: string;

  @ApiProperty({ example: SWAGGER_FIXTURES.zero })
  @IsString()
  zone: string;

  @ApiProperty({ example: SWAGGER_FIXTURES.zoneHash })
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

  @ApiProperty({ example: SWAGGER_FIXTURES.conduitKey })
  @IsString()
  conduitKey: string;

  @ApiProperty()
  @IsString()
  counter: string;
}

export class CreateOrderDto {
  @ApiPropertyOptional({
    description: 'ask=판매 listing, bid=구매 주문 (ERC721 또는 ERC721_WITH_CRITERIA)',
    enum: ['ask', 'bid'],
    default: 'ask',
  })
  @IsOptional()
  @IsIn(['ask', 'bid'])
  side?: 'ask' | 'bid';

  @ApiProperty({ description: 'Seaport 주문 parameters' })
  @IsObject()
  @ValidateNested()
  @Type(() => SeaportOrderParametersDto)
  parameters: SeaportOrderParametersDto;

  @ApiProperty({ example: SWAGGER_FIXTURES.signature })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiProperty({ example: SWAGGER_FIXTURES.rwaContract })
  @IsEthereumAddress()
  tokenContract: string;

  /** ask: minted ERC-721 id (includes `0`). criteria bid: sentinel `"0"`. */
  @ApiProperty({
    description: 'Ask: tokenId (첫 mint는 `0` 가능). Criteria bid: `"0"` 사용.',
    example: '1',
  })
  @IsNumberString()
  tokenId: string;

  @ApiProperty({ example: SWAGGER_FIXTURES.usdc })
  @IsEthereumAddress()
  considerationToken: string;

  @ApiProperty({ example: '150000000', description: 'USDC 금액 (소수 6자리)' })
  @IsNumberString()
  considerationAmount: string;

  @ApiPropertyOptional({
    description: 'ERC721_WITH_CRITERIA bid(컬렉션 전체 입찰)일 때 필수',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  collectionKey?: string;
}
