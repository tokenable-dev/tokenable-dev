import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { SWAGGER_FIXTURES } from '../../../swagger/fixtures';

export class FulfillMatchedPairDto {
  @ApiProperty({ description: '체결할 bid 주문 hash', example: SWAGGER_FIXTURES.orderHashBid })
  @IsString()
  @IsNotEmpty()
  bidOrderHash: string;

  @ApiProperty({ description: '체결할 ask 주문 hash', example: SWAGGER_FIXTURES.orderHash })
  @IsString()
  @IsNotEmpty()
  askOrderHash: string;
}
