import { ApiProperty } from '@nestjs/swagger';
import { IsEthereumAddress, IsIn, IsString } from 'class-validator';

export const ADMIN_RWA_ROLE_KEYS = [
  'default_admin',
  'minter',
  'burner',
  'pauser',
] as const;

export type AdminRwaRoleKey = (typeof ADMIN_RWA_ROLE_KEYS)[number];

export class AdminRwaRoleWalletQueryDto {
  @ApiProperty({ example: '0x1234567890123456789012345678901234567890' })
  @IsString()
  @IsEthereumAddress()
  wallet!: string;
}

export class AdminRwaRoleMutationDto {
  @ApiProperty({ example: '0x1234567890123456789012345678901234567890' })
  @IsString()
  @IsEthereumAddress()
  walletAddress!: string;

  @ApiProperty({
    enum: ADMIN_RWA_ROLE_KEYS,
    example: 'minter',
    description:
      'default_admin = upgrades + role grants; minter = mint; burner = adminBurn; pauser = pause/unpause',
  })
  @IsIn([...ADMIN_RWA_ROLE_KEYS])
  role!: AdminRwaRoleKey;
}
