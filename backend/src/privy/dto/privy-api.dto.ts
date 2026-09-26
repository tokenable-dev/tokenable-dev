import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class PrivyVerifyAccessTokenDto {
  @ApiProperty({
    description: 'Privy access token from `usePrivy().getAccessToken()` or Dashboard test token',
    example: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @MinLength(10)
  accessToken!: string;
}

export class PrivySearchUsersDto {
  @ApiPropertyOptional({ example: 'alice@example.com' })
  @IsOptional()
  @IsString()
  searchTerm?: string;

  @ApiPropertyOptional({ type: [String], example: ['alice@example.com'] })
  @IsOptional()
  emails?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  walletAddresses?: string[];
}

export class PrivyLookupEmailDto {
  @ApiProperty({ example: 'dev@example.com' })
  @IsEmail()
  address!: string;
}

export class PrivyLookupWalletDto {
  @ApiProperty({ example: '0x2925a6Fa34C2CF44B3d2857777D7a301077211f7' })
  @IsString()
  @MinLength(10)
  address!: string;
}

export class PrivyCreateUserDto {
  @ApiProperty({
    example: [{ type: 'email', address: 'test@privy.io' }],
    description: 'Privy linked_accounts payload',
  })
  @IsObject({ each: true })
  linked_accounts!: Array<Record<string, unknown>>;
}

export class PrivySetMetadataDto {
  @ApiProperty({ example: { kycTier: 'pending', source: 'swagger' } })
  custom_metadata!: Record<string, string | number | boolean>;
}

export class PrivyListUsersQueryDto {
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Privy cursor for pagination' })
  @IsOptional()
  @IsString()
  cursor?: string;
}
