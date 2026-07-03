import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RedeemRequestDto {
  @ApiProperty({ description: 'tokenId of the NFT to redeem', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tokenId!: number;
}
