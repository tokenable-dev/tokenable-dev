import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength } from 'class-validator';

export class SetP2pTrackingDto {
  @ApiProperty({ enum: ['FedEx', 'DHL', 'UPS'] })
  @IsIn(['FedEx', 'DHL', 'UPS'])
  carrier!: 'FedEx' | 'DHL' | 'UPS';

  @ApiProperty()
  @IsString()
  @MaxLength(128)
  trackingNumber!: string;
}
