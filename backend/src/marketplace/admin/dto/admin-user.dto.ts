import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminUserListQueryDto {
  @ApiPropertyOptional({ description: 'Search email, name, Privy ID, or wallet' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({
    enum: [
      'all',
      'privy',
      'legacy',
      'google',
      'email',
      'wallet',
      'verified',
      'unverified',
      'with_wallet',
      'kyc_approved',
      'kyc_pending',
      'kyc_rejected',
      'kyc_none',
    ],
  })
  @IsOptional()
  @IsIn([
    'all',
    'privy',
    'legacy',
    'google',
    'email',
    'wallet',
    'verified',
    'unverified',
    'with_wallet',
    'kyc_approved',
    'kyc_pending',
    'kyc_rejected',
    'kyc_none',
  ])
  filter?:
    | 'all'
    | 'privy'
    | 'legacy'
    | 'google'
    | 'email'
    | 'wallet'
    | 'verified'
    | 'unverified'
    | 'with_wallet'
    | 'kyc_approved'
    | 'kyc_pending'
    | 'kyc_rejected'
    | 'kyc_none';

  @ApiPropertyOptional({
    description:
      'Partner role via wallet ∩ marketplace_partners (active or inactive)',
    enum: ['partner', 'individual'],
  })
  @IsOptional()
  @IsIn(['partner', 'individual'])
  role?: 'partner' | 'individual';

  @ApiPropertyOptional({
    description:
      'Account moderation status. restricted/suspended have no backend yet — return empty.',
    enum: ['all', 'active', 'restricted', 'suspended'],
    default: 'all',
  })
  @IsOptional()
  @IsIn(['all', 'active', 'restricted', 'suspended'])
  accountStatus?: 'all' | 'active' | 'restricted' | 'suspended';

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 30, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class AdminUpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;
}

export class AdminLinkUserWalletDto {
  @ApiProperty({ example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/)
  address!: string;
}

export class AdminUpdateUserKycDto {
  @ApiProperty({ enum: ['none', 'pending', 'approved', 'rejected'] })
  @IsIn(['none', 'pending', 'approved', 'rejected'])
  status!: 'none' | 'pending' | 'approved' | 'rejected';

  @ApiPropertyOptional({ description: 'Required when status is rejected' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

export class AdminUserIdParamDto {
  @ApiProperty()
  @IsUUID()
  id!: string;
}
