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
  @ApiProperty({ description: '새 listing에 서명한 지갑 (기존 listing 소유자와 동일해야 함)' })
  @IsEthereumAddress()
  callerAddress: string;

  @ApiProperty({ description: '취소할 활성 ask의 orderHash' })
  @IsString()
  @IsNotEmpty()
  oldOrderHash: string;

  @ApiProperty({
    type: CreateOrderDto,
    description: '새로 서명한 ask (동일 tokenId, 가격/서명만 변경)',
  })
  @ValidateNested()
  @Type(() => CreateOrderDto)
  order: CreateOrderDto;
}
