import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEthereumAddress, IsOptional, Matches } from 'class-validator';
import { SWAGGER_FIXTURES } from '../../../swagger/fixtures';

export class FulfillOrderQueryDto {
  @ApiPropertyOptional({
    description: 'Buyer wallet (required to seed marketplace cost basis on ask fills)',
    example: SWAGGER_FIXTURES.wallet,
  })
  @IsOptional()
  @IsEthereumAddress()
  buyerAddress?: string;

  @ApiPropertyOptional({
    description: 'On-chain fulfillOrder tx hash (portfolio tx history link)',
    example:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  @IsOptional()
  @Matches(/^0x[a-fA-F0-9]{64}$/)
  fillTxHash?: string;
}
