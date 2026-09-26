import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEthereumAddress, IsOptional } from 'class-validator';
import { SWAGGER_FIXTURES } from '../../../swagger/fixtures';

export class FulfillOrderQueryDto {
  @ApiPropertyOptional({
    description: 'Buyer wallet (required to seed marketplace cost basis on ask fills)',
    example: SWAGGER_FIXTURES.wallet,
  })
  @IsOptional()
  @IsEthereumAddress()
  buyerAddress?: string;
}
