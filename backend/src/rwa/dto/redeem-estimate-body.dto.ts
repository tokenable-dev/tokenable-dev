import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { RedeemShipToDto } from './redeem-request.dto';

/** POST body for redeem fee estimate (includes shipTo for FedEx Rate). */
export class RedeemEstimateBodyDto {
  @ApiProperty({ enum: ['us', 'ca', 'intl'], example: 'us' })
  @IsIn(['us', 'ca', 'intl'])
  country!: 'us' | 'ca' | 'intl';

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  cardCount?: number;

  @ApiPropertyOptional({ type: [Number], example: [12, 34] })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  tokenIds?: number[];

  @ApiPropertyOptional({
    type: RedeemShipToDto,
    description: 'Required for accurate Partner FedEx Rate quotes',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RedeemShipToDto)
  shipTo?: RedeemShipToDto;
}
