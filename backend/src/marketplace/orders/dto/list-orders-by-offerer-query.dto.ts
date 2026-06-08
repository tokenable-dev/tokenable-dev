import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SWAGGER_FIXTURES } from '../../../swagger/fixtures';
import { Type } from 'class-transformer';
import { IsEthereumAddress, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListOrdersByOffererQueryDto {
  @ApiProperty({ description: '주문 제출자(offerer) 지갑', example: SWAGGER_FIXTURES.wallet })
  @IsEthereumAddress()
  offerer: string;

  @ApiProperty({ description: '주문 방향 (현재 bid만 지원)', enum: ['bid'], example: 'bid' })
  @IsIn(['bid'])
  side: 'bid';

  @ApiPropertyOptional({ example: 100, description: '최대 행 수 (서버 상한 500)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
