import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SWAGGER_FIXTURES } from '../../../swagger/fixtures';
import { Type } from 'class-transformer';
import { IsEthereumAddress, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListOrdersByOffererQueryDto {
  @ApiProperty({ example: SWAGGER_FIXTURES.wallet })
  @IsEthereumAddress()
  offerer: string;

  @ApiProperty({ enum: ['bid'], example: 'bid' })
  @IsIn(['bid'])
  side: 'bid';

  @ApiPropertyOptional({ example: 100, description: 'Max rows (server cap 500)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
