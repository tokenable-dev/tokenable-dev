import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { SWAGGER_FIXTURES } from '../../swagger/fixtures';

export class LinkWalletDto {
  @ApiProperty({ example: SWAGGER_FIXTURES.wallet })
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid wallet address' })
  address!: string;
}
