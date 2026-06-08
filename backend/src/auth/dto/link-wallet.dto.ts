import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { SWAGGER_FIXTURES } from '../../swagger/fixtures';

export class LinkWalletDto {
  @ApiProperty({ description: '연결할 지갑 주소', example: SWAGGER_FIXTURES.wallet })
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: '유효하지 않은 지갑 주소입니다' })
  address!: string;
}
