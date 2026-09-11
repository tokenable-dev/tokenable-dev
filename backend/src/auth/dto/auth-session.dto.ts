import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional()
  marketingEmailsOptIn?: boolean;

  @ApiPropertyOptional()
  emailNotificationsEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Email category prefs: trades, bids, price, vault',
  })
  emailNotifPrefs?: {
    trades: boolean;
    bids: boolean;
    price: boolean;
    vault: boolean;
  };

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
