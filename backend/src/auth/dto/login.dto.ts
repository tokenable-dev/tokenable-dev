import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'collector@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'secure-pass-123' })
  @IsString()
  @MinLength(1)
  password!: string;
}
