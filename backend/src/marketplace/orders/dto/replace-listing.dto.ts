import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEthereumAddress,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateOrderDto } from './create-order.dto';

export class ReplaceListingDto {
  @ApiProperty({
    description:
      'Wallet that signed the new listing (must own the old listing)',
  })
  @IsEthereumAddress()
  callerAddress: string;

  @ApiProperty({ description: 'orderHash of the active ask to cancel' })
  @IsString()
  @IsNotEmpty()
  oldOrderHash: string;

  @ApiProperty({
    type: CreateOrderDto,
    description: 'New signed ask (same tokenId, new price/signature)',
  })
  @ValidateNested()
  @Type(() => CreateOrderDto)
  order: CreateOrderDto;
}
