import { ApiProperty } from '@nestjs/swagger';
import { IsEthereumAddress, IsIn, IsInt, IsString, MinLength } from 'class-validator';
import { SUPPORTED_CHAIN_IDS } from '../../../blockchain/chain-config.service';

/** Dev/staging only — checked against `MARKETPLACE_ADMIN_DB_RESET_PASSWORD`. */
export class AdminDataInventoryResetDto {
  @ApiProperty({
    description: 'Must match MARKETPLACE_ADMIN_DB_RESET_PASSWORD',
    example: '••••',
  })
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiProperty({
    description: 'Network whose contract marketplace to wipe',
    example: 11155111,
    enum: SUPPORTED_CHAIN_IDS,
  })
  @IsInt()
  @IsIn(SUPPORTED_CHAIN_IDS)
  chainId!: (typeof SUPPORTED_CHAIN_IDS)[number];

  @ApiProperty({
    description:
      'RWA contract address to wipe. Defaults to the address currently configured for chainId; paste a previous address to wipe that deployment only.',
    example: '0x1111111111111111111111111111111111111111',
  })
  @IsEthereumAddress()
  tokenContract!: string;
}
