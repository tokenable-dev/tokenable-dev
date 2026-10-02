import { ApiProperty } from '@nestjs/swagger';
import { IsEthereumAddress, IsString } from 'class-validator';

export class BurnKbwMysteryCardDto {
  @ApiProperty({ example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0' })
  @IsString()
  @IsEthereumAddress()
  walletAddress: string;
}
