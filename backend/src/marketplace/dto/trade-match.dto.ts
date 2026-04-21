import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class TradeMatchDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  bidId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  askId!: string;

  @ApiProperty({ description: 'Settlement target token id (must match ask.tokenId)' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  tokenId!: string;
}
