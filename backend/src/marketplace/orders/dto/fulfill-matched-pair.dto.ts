import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { SWAGGER_FIXTURES } from '../../../swagger/fixtures';

export class FulfillMatchedPairDto {
  @ApiProperty({ example: SWAGGER_FIXTURES.orderHashBid })
  @IsString()
  @IsNotEmpty()
  bidOrderHash: string;

  @ApiProperty({ example: SWAGGER_FIXTURES.orderHash })
  @IsString()
  @IsNotEmpty()
  askOrderHash: string;
}
