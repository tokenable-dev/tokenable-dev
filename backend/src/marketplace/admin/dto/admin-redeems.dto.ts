import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Equals,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminRedeemsListQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by vault_redemptions.status',
  })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by payment_batch_id' })
  @IsOptional()
  @IsUUID()
  paymentBatchId?: string;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class AdminRedeemMemoDto {
  @ApiProperty({ description: 'Admin memo (empty string clears)' })
  @IsString()
  @MaxLength(4000)
  memo!: string;
}

export class AdminRedeemTrackingDto {
  @ApiProperty({ example: '1Z999AA10123456784' })
  @IsString()
  @MaxLength(128)
  trackingNumber!: string;

  @ApiPropertyOptional({ example: 'ups' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  trackingCarrier?: string;
}

/** Apply tracking to one vault shipment within a payment batch. */
export class AdminRedeemShipmentTrackingDto extends AdminRedeemTrackingDto {
  @ApiProperty({
    example: 'psa_vault',
    description: 'psa_vault or partner:<vault_partner_id>',
  })
  @IsString()
  @MaxLength(80)
  shipmentKey!: string;
}

/** Partner portal — scope tracking to explicit redemption rows (never whole partner vault). */
export class PartnerRedeemShipmentTrackingDto extends AdminRedeemShipmentTrackingDto {
  @ApiProperty({
    type: [String],
    description:
      'Redemption row ids in this shipment (batch + ship-to). Required for partner writes.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  redemptionIds!: string[];
}

/** Dev/staging only — must match exactly. */
export class AdminRedeemPurgeDto {
  @ApiProperty({ example: 'DELETE_ALL_REDEEMS' })
  @IsString()
  @Equals('DELETE_ALL_REDEEMS')
  confirm!: string;
}
