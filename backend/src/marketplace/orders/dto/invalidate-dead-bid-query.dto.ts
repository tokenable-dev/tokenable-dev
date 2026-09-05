import { ApiProperty } from '@nestjs/swagger';
import { IsEthereumAddress } from 'class-validator';
import { SWAGGER_FIXTURES } from '../../../swagger/fixtures';

export class InvalidateDeadBidQueryDto {
  @ApiProperty({
    description: 'Wallet that attempted accept / reported the dead offer',
    example: SWAGGER_FIXTURES.wallet,
  })
  @IsEthereumAddress()
  callerAddress: string;
}
