import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class DeleteAccountDto {
  /** Optional leftover field; delete-account does not verify a password. */
  @ApiPropertyOptional({ example: 'your-current-password' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password?: string;
}
