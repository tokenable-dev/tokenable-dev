import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class MarketplaceAdminLoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @MinLength(1)
  username!: string;

  @ApiProperty({
    example: 'your-admin-password',
    description: 'MARKETPLACE_ADMIN_PASSWORD (또는 Dashboard에 설정한 값)',
  })
  @IsString()
  @MinLength(1)
  password!: string;
}
