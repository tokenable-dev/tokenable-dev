import { ApiProperty } from '@nestjs/swagger';
import { IsEthereumAddress, IsNumberString } from 'class-validator';

export class ValidateBucketMatchDto {
  @ApiProperty({ example: '42' })
  @IsNumberString()
  tokenId: string;

  @ApiProperty({ description: '판매자(토큰 소유자) 지갑' })
  @IsEthereumAddress()
  sellerAddress: string;
}
