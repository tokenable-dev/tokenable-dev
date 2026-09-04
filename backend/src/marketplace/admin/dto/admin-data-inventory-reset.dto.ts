import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/** Dev/staging only — checked against `MARKETPLACE_ADMIN_DB_RESET_PASSWORD`. */
export class AdminDataInventoryResetDto {
  @ApiProperty({
    description: 'Must match MARKETPLACE_ADMIN_DB_RESET_PASSWORD',
    example: '••••',
  })
  @IsString()
  @MinLength(1)
  password!: string;
}
