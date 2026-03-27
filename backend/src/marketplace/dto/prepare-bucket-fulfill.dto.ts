import { ApiProperty } from '@nestjs/swagger';
import { IsNumberString } from 'class-validator';

export class PrepareBucketFulfillDto {
  @ApiProperty({ description: '판매할 NFT tokenId', example: '42' })
  @IsNumberString()
  tokenId: string;
}
