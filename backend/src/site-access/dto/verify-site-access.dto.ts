import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VerifySiteAccessDto {
  @ApiProperty({
    description: 'Site access 비밀번호 (`SITE_ACCESS_PASSWORD`)',
    example: '',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  password!: string;
}
