import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEthereumAddress,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateOrderDto } from './create-order.dto';

export class ReplaceBidDto {
  @ApiProperty({
    description:
      'Wallet that signed the new bid (must own the old collection bid)',
  })
  @IsEthereumAddress()
  callerAddress: string;

  @ApiProperty({ description: 'orderHash of the active collection bid to cancel' })
  @IsString()
  @IsNotEmpty()
  oldOrderHash: string;

  @ApiProperty({
    type: CreateOrderDto,
    description: 'New signed collection bid (same collectionKey, new price/signature)',
  })
  @ValidateNested()
  @Type(() => CreateOrderDto)
  order: CreateOrderDto;
}
