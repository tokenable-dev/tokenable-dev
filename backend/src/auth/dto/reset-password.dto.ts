import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Raw token from the reset email link' })
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token!: string;

  @ApiProperty({ minLength: 8, example: 'new-secure-pass' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
