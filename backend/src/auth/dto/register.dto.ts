import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'collector@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: 'secure-pass-123' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ example: 'Alex Collector' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}
