import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class RecordP2pSettlementDto {
  @ApiProperty({
    description: 'confirmReceipt or settleAfterTimeout tx hash',
  })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/)
  releaseTxHash!: string;

  @ApiPropertyOptional({
    enum: ['confirm', 'timeout'],
    default: 'confirm',
  })
  @IsOptional()
  @IsIn(['confirm', 'timeout'])
  source?: 'confirm' | 'timeout';
}
