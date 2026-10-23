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
  @ApiProperty({ description: '새 bid에 서명한 지갑 (기존 collection bid 소유자와 동일)' })
  @IsEthereumAddress()
  callerAddress: string;

  @ApiProperty({ description: '취소할 활성 collection bid의 orderHash' })
  @IsString()
  @IsNotEmpty()
  oldOrderHash: string;

  @ApiProperty({
    type: CreateOrderDto,
    description: '새로 서명한 collection bid (동일 collectionKey, 가격/서명만 변경)',
  })
  @ValidateNested()
  @Type(() => CreateOrderDto)
  order: CreateOrderDto;
}
