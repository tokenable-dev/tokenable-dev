import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PrivyStatusResponseDto {
  @ApiProperty()
  configured!: boolean;

  @ApiPropertyOptional()
  appId?: string | null;

  @ApiProperty({ description: 'Number of catalogued Privy capabilities' })
  catalogCount!: number;

  @ApiProperty({ type: [String] })
  swaggerTryPaths!: string[];

  @ApiProperty({
    description: 'Apple Pay / Google Pay are available via client `useFiatOnramp` on mainnet only',
  })
  applePayGooglePay!: {
    available: boolean;
    surface: string;
    clientHook: string;
    note: string;
  };
}

export class AuthSessionUserWalletDto {
  @ApiProperty()
  address!: string;

  @ApiProperty()
  linkedAt!: string;

  @ApiProperty()
  isPrimary!: boolean;
}

export class AuthSessionUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;

  @ApiPropertyOptional({ nullable: true })
  pictureUrl!: string | null;

  @ApiProperty()
  emailVerified!: boolean;

  @ApiProperty()
  hasPassword!: boolean;

  @ApiPropertyOptional({ nullable: true })
  privyId!: string | null;

  @ApiPropertyOptional({ enum: ['none', 'pending', 'approved', 'rejected'] })
  kycStatus?: string;

  @ApiPropertyOptional({ nullable: true })
  walletAddress!: string | null;

  @ApiPropertyOptional({ type: [AuthSessionUserWalletDto] })
  wallets?: AuthSessionUserWalletDto[];
}

export class AuthSessionResponseDto {
  @ApiProperty({ type: AuthSessionUserDto, nullable: true })
  user!: AuthSessionUserDto | null;
}
