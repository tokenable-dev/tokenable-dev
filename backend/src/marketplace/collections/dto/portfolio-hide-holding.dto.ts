import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Matches, Min } from 'class-validator';

export class PortfolioHideHoldingDto {
  @ApiProperty({ example: '0xabc…' })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/)
  walletAddress!: string;

  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(0)
  tokenId!: number;
}
